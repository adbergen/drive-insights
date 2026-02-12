import { Router, type IRouter, type Response } from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import {
  createOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
} from "../services/google-auth";
import { requireEnv } from "../env";

const router: IRouter = Router();

const COOKIE_NAME = "token";
const JWT_EXPIRY = "7d";
const JWT_SECRET = requireEnv("JWT_SECRET");

function setAuthCookie(res: Response, email: string): void {
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// Redirect user to Google consent screen
router.get("/google", (_req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// Handle OAuth callback (exchange code for tokens and store in DB)
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      res
        .status(400)
        .json({ error: "Missing access token from Google response" });
      return;
    }

    // Get user email from the access token
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const email = userInfo.email;
    if (!email) {
      res.status(400).json({ error: "Could not determine user email" });
      return;
    }

    // Fallback to 1 hour from now if Google omits expiry_date
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Only overwrite refresh token if Google returned a new one
    const updateData: Prisma.OAuthTokenUpdateInput = {
      accessToken: tokens.access_token,
      expiresAt,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    };

    // Upsert tokens in DB
    await prisma.oAuthToken.upsert({
      where: { email },
      update: updateData,
      create: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt,
      },
    });

    // Issue JWT session cookie
    setAuthCookie(res, email);

    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    res.redirect(clientOrigin);
  } catch (err) {
    console.error("OAuth callback error:", err);
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    res.redirect(`${clientOrigin}?error=oauth_failed`);
  }
});

// Check if user is connected to Google
router.get("/status", async (req, res) => {
  try {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    if (!cookieToken) {
      res.json({ connected: false });
      return;
    }

    const payload = jwt.verify(cookieToken, JWT_SECRET) as { email: string };

    const token = await prisma.oAuthToken.findUnique({
      where: { email: payload.email },
    });

    if (token) {
      res.json({
        connected: true,
        email: token.email,
        hasRefreshToken: !!token.refreshToken,
        accessTokenExpiresAt: token.expiresAt,
      });
    } else {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.json({ connected: false });
    }
  } catch {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ connected: false });
  }
});

// Disconnect Google account
router.delete("/disconnect", async (req, res) => {
  try {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    if (cookieToken) {
      try {
        const payload = jwt.verify(cookieToken, JWT_SECRET) as { email: string };
        await prisma.oAuthToken.delete({ where: { email: payload.email } }).catch(() => {});
      } catch {
        // invalid cookie — nothing to delete
      }
    }
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ disconnected: true });
  } catch (err) {
    console.error("Disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
