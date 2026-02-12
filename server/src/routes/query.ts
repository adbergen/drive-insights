import { Router, type IRouter } from "express";
import {
  classifyIntent,
  executeIntent,
  generateAnswer,
} from "../services/ai-query";

const router: IRouter = Router();

router.post("/", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "OpenAI API key not configured" });
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
