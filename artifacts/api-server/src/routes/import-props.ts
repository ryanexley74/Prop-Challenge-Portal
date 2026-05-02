import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { z } from "zod";

const router: IRouter = Router();

const ImportPropsBodySchema = z.union([
  z.object({ url: z.string().url(), text: z.undefined() }),
  z.object({ text: z.string().min(1), url: z.undefined() }),
  z.object({ url: z.string().url(), text: z.string().min(1) }),
]);

const ImportPropsParamsSchema = z.object({ gameId: z.coerce.number().int() });

const ParsedPropSchema = z.object({
  question: z.string(),
  type: z.enum(["yes_no", "over_under"]),
  threshold: z.number().nullable().optional(),
});

const AiResponseSchema = z.object({
  props: z.array(ParsedPropSchema),
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const SYSTEM_PROMPT = `You are extracting prop bet questions from a sports prop bet sheet.
Extract every distinct prop bet question from the provided text.
For each prop, determine:
- "question": the full prop bet question as written (clean it up if needed)
- "type": "yes_no" if the prop is answered yes or no (will/won't, does/doesn't, etc.), or "over_under" if it has a numeric threshold (e.g. "over/under 2.5 touchdowns")
- "threshold": for over_under props, extract the numeric threshold (e.g. 2.5). Null for yes_no.

Respond ONLY with valid JSON matching this exact shape:
{"props": [{"question": "...", "type": "yes_no" | "over_under", "threshold": number | null}]}

Do not include any explanation outside the JSON. Deduplicate props. Ignore page headers, navigation, and ads.`;

router.post("/games/:gameId/import-props", async (req, res) => {
  try {
    const { gameId } = ImportPropsParamsSchema.parse(req.params);
    const body = ImportPropsBodySchema.parse(req.body);

    let contentText: string;
    let sourceTitle: string;

    if (body.text) {
      // Direct text paste — skip fetching
      contentText = body.text.slice(0, 12000);
      sourceTitle = "Pasted text";
      req.log.info({ gameId, chars: contentText.length }, "Parsing pasted text for prop import");
    } else {
      // Fetch from URL
      const url = body.url!;
      req.log.info({ gameId, url }, "Fetching URL for prop import");

      const fetchRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PropBetBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });

      if (!fetchRes.ok) {
        req.log.warn({ status: fetchRes.status, url }, "Failed to fetch URL");
        return res.status(400).json({ error: `Could not fetch URL (HTTP ${fetchRes.status})` });
      }

      const html = await fetchRes.text();
      contentText = stripHtml(html).slice(0, 12000);
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      sourceTitle = titleMatch ? stripHtml(titleMatch[1]) : url;
    }

    const client = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentText },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = AiResponseSchema.parse(JSON.parse(raw));

    req.log.info({ gameId, count: parsed.props.length }, "Extracted props");
    res.json({ props: parsed.props, sourceTitle });
  } catch (err) {
    req.log.error({ err }, "Failed to import props");
    res.status(500).json({ error: "Failed to fetch or parse the content" });
  }
});

export default router;
