import "./env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/prisma";
import { requireAuth } from "./middleware/auth";
import authRoutes from "./routes/auth";
import syncRoutes from "./routes/sync";
import filesRoutes from "./routes/files";
import queryRoutes from "./routes/query";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/sync", requireAuth, syncRoutes);
app.use("/api/files", requireAuth, filesRoutes);
app.use("/api/query", requireAuth, queryRoutes);

// Health check with DB connectivity
app.get("/api/health", async (_req, res) => {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (_) {
    // db stays false
  }
  res.json({ ok: true, db, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
