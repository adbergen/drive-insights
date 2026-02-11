import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import {
  createOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
} from "../services/google-auth";

const router: IRouter = Router();

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

    // Redirect back to client
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    res.redirect(clientOrigin);
  } catch (err) {
    console.error("OAuth callback error:", err);
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    res.redirect(`${clientOrigin}?error=oauth_failed`);
  }
});

// Check if user is connected to Google
router.get("/status", async (_req, res) => {
  try {
    const token = await prisma.oAuthToken.findFirst();
    if (token) {
      res.json({
        connected: true,
        email: token.email,
        hasRefreshToken: !!token.refreshToken,
        accessTokenExpiresAt: token.expiresAt,
      });
    } else {
      res.json({ connected: false });
    }
  } catch (err) {
    console.error("Auth status error:", err);
    res.json({ connected: false });
  }
});

// Disconnect Google account
router.delete("/disconnect", async (_req, res) => {
  try {
    await prisma.oAuthToken.deleteMany();
    res.json({ disconnected: true });
  } catch (err) {
    console.error("Disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
