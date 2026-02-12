import { google } from "googleapis";
import { prisma } from "../lib/prisma";
import type { Prisma } from "../generated/prisma/client";
import { createOAuth2Client } from "./google-auth";

const DRIVE_FILE_FIELDS =
  "nextPageToken,files(id,name,mimeType,size,owners(emailAddress,displayName),createdTime,modifiedTime,webViewLink,trashed)";

/** Build an OAuth2 client from stored tokens, with automatic refresh. */
export async function getAuthenticatedClient() {
  const token = await prisma.oAuthToken.findFirst();
  if (!token) throw new Error("No OAuth token found. Connect Google first.");

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken || undefined,
    expiry_date: token.expiresAt.getTime(),
  });

  // Persist refreshed tokens back to DB
  client.on("tokens", async (newTokens) => {
    const data: Prisma.OAuthTokenUpdateInput = {
      ...(newTokens.access_token ? { accessToken: newTokens.access_token } : {}),
      ...(newTokens.expiry_date ? { expiresAt: new Date(newTokens.expiry_date) } : {}),
      ...(newTokens.refresh_token ? { refreshToken: newTokens.refresh_token } : {}),
    };
    if (Object.keys(data).length > 0) {
      await prisma.oAuthToken.update({ where: { email: token.email }, data });
    }
  });

  return client;
}

/** Sync all Drive files to the local database. Returns the number of files synced. */
export async function syncDriveFiles(): Promise<{ synced: number }> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: "v3", auth });

  let synced = 0;
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      pageSize: 1000,
      fields: DRIVE_FILE_FIELDS,
      pageToken,
    });

    const files = res.data.files ?? [];
    const now = new Date();

    const upsertOperations = files
      .filter((file) => !!file.id)
      .map((file) => {
        const owner = file.owners?.[0];
        const fields = {
          name: file.name ?? "Untitled",
          mimeType: file.mimeType ?? "application/octet-stream",
          size: file.size ? BigInt(file.size) : null,
          ownerEmail: owner?.emailAddress ?? null,
          ownerName: owner?.displayName ?? null,
          createdTime: file.createdTime ? new Date(file.createdTime) : null,
          modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
          webViewLink: file.webViewLink ?? null,
          trashed: file.trashed ?? false,
          lastSyncedAt: now,
        };
        return prisma.driveFile.upsert({
          where: { driveId: file.id! },
          update: fields,
          create: { driveId: file.id!, ...fields },
        });
      });

    for (let i = 0; i < upsertOperations.length; i += 100) {
      await prisma.$transaction(upsertOperations.slice(i, i + 100));
    }
    synced += upsertOperations.length;

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { synced };
}
