import { Router, type IRouter } from "express";
import {
  classifyIntent,
  executeIntent,
  generateAnswer,
} from "../services/ai-query";

const router: IRouter = Router();

// Simple per-user rate limiter: 10 queries per minute
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const userRequests = new Map<string, number[]>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const timestamps = (userRequests.get(email) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  userRequests.set(email, timestamps);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  return false;
}

router.post("/", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "OpenAI API key not configured" });
    }

    if (isRateLimited(req.userEmail!)) {
      return res.status(429).json({ error: "Too many queries. Please wait a minute." });
    }

    const intent = await classifyIntent(question.trim());
    const result = await executeIntent(intent);
    const answer = await generateAnswer(question.trim(), result);

    res.json({
      question: question.trim(),
      answer,
      intent: intent.type,
      files: result.files,
      total: result.total,
      stats: result.stats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Query error:", message, err);

    if (err instanceof Error && "status" in err) {
      const status = (err as { status: number }).status;
      if (status === 429) {
        return res
          .status(429)
          .json({ error: "AI rate limit exceeded. Please try again later." });
      }
      if (status === 401) {
        return res
          .status(503)
          .json({ error: "OpenAI authentication failed" });
      }
    }

    res.status(500).json({ error: `Failed to process question: ${message}` });
  }
});

export default router;
