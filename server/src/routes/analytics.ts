import { Router, type IRouter } from "express";
import { computeAnalytics } from "../services/analytics";
import { getClient } from "../lib/openai";

const router: IRouter = Router();

// --- Insights rate limiter: 5 per minute per user ---
const INSIGHTS_RATE_LIMIT = 5;
const INSIGHTS_RATE_WINDOW_MS = 60_000;
const insightsRequests = new Map<string, number[]>();

function isInsightsRateLimited(email: string): boolean {
  const now = Date.now();
  const timestamps = (insightsRequests.get(email) ?? []).filter(
    (t) => now - t < INSIGHTS_RATE_WINDOW_MS,
  );

  if (timestamps.length >= INSIGHTS_RATE_LIMIT) {
    insightsRequests.set(email, timestamps);
    return true;
  }

  timestamps.push(now);
  insightsRequests.set(email, timestamps);
  return false;
}

// --- Insights cache: 5-min TTL keyed by user + analytics fingerprint ---
const CACHE_TTL_MS = 5 * 60_000;
const insightsCache = new Map<
  string,
  { insights: string[]; createdAt: number }
>();

function analyticsFingerprint(
  userEmail: string,
  data: {
    totalFiles: number;
    totalSize: number;
    uniqueOwners: number;
    activityByMonth: { month: string }[];
  },
): string {
  const lastMonth =
    data.activityByMonth.length > 0
      ? data.activityByMonth[data.activityByMonth.length - 1].month
      : "";
  return `${userEmail}:${data.totalFiles}:${data.totalSize}:${data.uniqueOwners}:${lastMonth}`;
}

// --- GET / — analytics summary ---
router.get("/", async (req, res) => {
  if (!req.userEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await computeAnalytics(req.userEmail);
    res.json(data);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to compute analytics" });
  }
});

// --- GET /insights — AI-powered insights from structured data ---
router.get("/insights", async (req, res) => {
  if (!req.userEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "OpenAI API key not configured" });
  }

  if (isInsightsRateLimited(req.userEmail)) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please wait a minute." });
  }

  try {
    const data = await computeAnalytics(req.userEmail);
    const key = analyticsFingerprint(req.userEmail, data);

    // Return cached insights if fingerprint matches and TTL is valid
    const cached = insightsCache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return res.json({ insights: cached.insights });
    }

    const completion = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a Google Drive analytics assistant.",
            "You will receive a JSON object with aggregated file statistics.",
            'Return a JSON object: { "insights": ["...", ...] }',
            "Rules:",
            "- Provide 3 to 5 actionable insights about the user's Drive data.",
            "- Only use facts present in the provided JSON. Do not invent numbers, percentages, dates, or file types not in the data.",
            "- If a claim requires a number not present, phrase qualitatively or omit.",
            "- Each insight must be a single plain sentence, max 200 characters.",
            "- No markdown, no bullets, no numbering, no special formatting.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify(data),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const insights: string[] = Array.isArray(parsed.insights)
      ? parsed.insights
          .filter((s: unknown): s is string => typeof s === "string")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0 && s.length <= 200)
      : [];

    // Cache the result; periodically prune expired entries
    insightsCache.set(key, { insights, createdAt: Date.now() });
    if (insightsCache.size > 50) {
      const now = Date.now();
      for (const [k, v] of insightsCache) {
        if (now - v.createdAt >= CACHE_TTL_MS) insightsCache.delete(k);
      }
    }

    res.json({ insights });
  } catch (err) {
    console.error("Insights error:", err);
    res.status(502).json({ error: "AI insights unavailable" });
  }
});

export default router;
