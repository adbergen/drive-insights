import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { requireEnv } from "../env";

declare global {
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}

interface JwtPayload {
  email: string;
}

const JWT_SECRET = requireEnv("JWT_SECRET");
const COOKIE_NAME = "token";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
