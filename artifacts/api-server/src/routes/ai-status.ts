import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

function detectProvider(baseUrl: string | undefined): string {
  if (!baseUrl) return "unconfigured";
  if (baseUrl.includes("openai.com")) return "openai";
  if (baseUrl.includes("googleapis.com")) return "gemini";
  if (baseUrl.includes("groq.com")) return "groq";
  return "custom";
}

function safeBaseUrlHost(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl;
  }
}

// GET /api/ai-status — returns current AI provider configuration (no network call)
router.get("/ai-status", (req, res) => {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const model   = process.env.AI_MODEL ?? "gpt-4o-mini";

  const configured = !!(baseUrl && apiKey);

  res.json({
    configured,
    provider:    detectProvider(baseUrl),
    model,
    baseUrlHost: safeBaseUrlHost(baseUrl),
  });
});

// POST /api/ai-status/test — makes a minimal real call to verify connectivity
router.post("/ai-status/test", async (req, res) => {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const model   = process.env.AI_MODEL ?? "gpt-4o-mini";

  if (!baseUrl || !apiKey) {
    res.json({ ok: false, latencyMs: 0, error: "AI provider is not configured" });
    return;
  }

  const client = new OpenAI({ baseURL: baseUrl, apiKey, timeout: 12_000 });
  const start  = Date.now();

  try {
    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: 'Reply with only the JSON: {"ok":true}' }],
      max_tokens: 16,
    });
    res.json({ ok: true, latencyMs: Date.now() - start });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.warn({ err }, "AI status test failed");
    res.json({ ok: false, latencyMs: Date.now() - start, error: message });
  }
});

export default router;
