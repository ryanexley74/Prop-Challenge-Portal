import OpenAI from "openai";
import { db, gamesTable, propsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "./logger";

const AiResponseSchema = z.object({
  resolutions: z.array(z.object({
    propId: z.number(),
    result: z.boolean(),
    confidence: z.enum(["high", "medium", "low"]),
  })),
  tallies: z.array(z.object({
    propId: z.number(),
    tally: z.string(),
  })).optional(),
});

export function extractSheetId(url: string): string | null {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export type SyncOutcome = {
  resolved: { propId: number; question: string; result: boolean }[];
  unmatched: string[];
  alreadyResolved: number;
  talliesUpdated: number;
  sheetUrl: string;
  error?: string;
};

export async function syncGameFromSheet(gameId: number, sheetUrl: string): Promise<SyncOutcome> {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    return { resolved: [], unmatched: [], alreadyResolved: 0, talliesUpdated: 0, sheetUrl, error: "Could not extract spreadsheet ID from URL" };
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  let csvText: string;
  try {
    const fetchRes = await fetch(csvUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PropBetBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!fetchRes.ok) {
      return {
        resolved: [], unmatched: [], alreadyResolved: 0, talliesUpdated: 0, sheetUrl,
        error: `Could not fetch the sheet (HTTP ${fetchRes.status}). Make sure it is shared as "Anyone with the link can view".`,
      };
    }
    csvText = await fetchRes.text();
  } catch {
    return { resolved: [], unmatched: [], alreadyResolved: 0, talliesUpdated: 0, sheetUrl, error: "Could not reach the Google Sheet." };
  }

  const props = await db.select().from(propsTable).where(eq(propsTable.gameId, gameId));
  if (props.length === 0) {
    return { resolved: [], unmatched: [], alreadyResolved: 0, talliesUpdated: 0, sheetUrl };
  }

  const unresolvedProps = props.filter(p => p.result === null || p.result === undefined);
  const alreadyResolved = props.length - unresolvedProps.length;

  if (unresolvedProps.length === 0) {
    return { resolved: [], unmatched: [], alreadyResolved, talliesUpdated: 0, sheetUrl };
  }

  const propsJson = unresolvedProps.map(p => ({
    propId: p.id,
    question: p.question,
    type: p.type,
    threshold: p.threshold ?? null,
  }));

  const client = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  });

  const systemPrompt = `You are resolving sports prop bet questions using live game data from a Google Sheet CSV.

PROPS TO RESOLVE (JSON):
${JSON.stringify(propsJson, null, 2)}

GOOGLE SHEET CSV DATA:
${csvText.slice(0, 8000)}

For each prop, scan the CSV for the answer. The sheet may show scores, stats, or explicit YES/NO answers.
- For "yes_no" props: result is true (YES) or false (NO)
- For "over_under" props: result is true (OVER) if the stat exceeds the threshold, false (UNDER) if not

Rules:
- Only resolve props where you find clear, unambiguous FINAL data
- Skip any prop where the game situation is still in progress or uncertain
- confidence: "high" = exact match found, "medium" = strong inference, "low" = uncertain

For UNRESOLVED over/under props still in progress, also extract the current running tally
(e.g. if the prop is "over/under 275.5 passing yards" and the sheet shows 142 so far, return tally "142").
Only include a tally if you find a clear numeric value for that stat. Keep tally values concise (e.g. "142", "3 TDs", "26 pts").

Respond ONLY with valid JSON matching this exact format:
{
  "resolutions": [{"propId": <number>, "result": <boolean>, "confidence": "high"|"medium"|"low"}],
  "tallies": [{"propId": <number>, "tally": "<current value string>"}]
}

If nothing can be resolved yet, return {"resolutions": [], "tallies": []}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let parsed: z.infer<typeof AiResponseSchema>;
  try {
    parsed = AiResponseSchema.parse(JSON.parse(raw));
  } catch {
    return { resolved: [], unmatched: [], alreadyResolved, talliesUpdated: 0, sheetUrl, error: "AI returned an unexpected format." };
  }

  const toApply = parsed.resolutions.filter(r => r.confidence !== "low");
  const appliedPropIds = new Set(toApply.map(r => r.propId));

  const unmatchedQuestions = unresolvedProps
    .filter(p => !appliedPropIds.has(p.id))
    .map(p => p.question);

  await Promise.all(
    toApply.map(({ propId, result }) =>
      db.update(propsTable)
        .set({ result, resolvedAt: new Date() })
        .where(eq(propsTable.id, propId))
    )
  );

  // Apply tallies for still-unresolved props
  const talliesToApply = (parsed.tallies ?? []).filter(t => !appliedPropIds.has(t.propId));
  await Promise.all(
    talliesToApply.map(({ propId, tally }) =>
      db.update(propsTable)
        .set({ tally })
        .where(eq(propsTable.id, propId))
    )
  );

  // Update lastSheetSync on the game
  await db.update(gamesTable)
    .set({ lastSheetSync: new Date() })
    .where(eq(gamesTable.id, gameId));

  const resolvedSummary = toApply.map(r => {
    const prop = unresolvedProps.find(p => p.id === r.propId);
    return { propId: r.propId, question: prop?.question ?? "", result: r.result };
  });

  logger.info({ gameId, resolved: resolvedSummary.length, tallies: talliesToApply.length, unmatched: unmatchedQuestions.length }, "Sheet sync complete");

  return {
    resolved: resolvedSummary,
    unmatched: unmatchedQuestions,
    alreadyResolved,
    talliesUpdated: talliesToApply.length,
    sheetUrl,
  };
}
