import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { prisma } from "../lib/prisma";
import type { Prisma } from "../generated/prisma/client";
import { getAuthenticatedClient } from "../services/drive-sync";

const router: IRouter = Router();

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// List files with pagination, search, and date filtering
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "modifiedTime";
    const order = req.query.order === "asc" ? "asc" : "desc";

    const where: Prisma.DriveFileWhereInput = { trashed: false };

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;

    if (fromDate || toDate) {
      where.modifiedTime = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const allowedSortFields = ["name", "mimeType", "ownerEmail", "modifiedTime"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "modifiedTime";

    const [files, total] = await Promise.all([
      prisma.driveFile.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          driveId: true,
          name: true,
          mimeType: true,
          ownerEmail: true,
          modifiedTime: true,
          webViewLink: true,
        },
      }),
      prisma.driveFile.count({ where }),
    ]);

    res.json({ files, total, page, limit });
  } catch (err) {
    console.error("Files list error:", err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// Get single file by Drive ID
router.get("/:driveId", async (req, res) => {
  try {
    const { driveId } = req.params;
    if (!driveId) return res.status(400).json({ error: "Invalid ID" });

    const file = await prisma.driveFile.findUnique({
      where: { driveId },
      select: {
        id: true,
        driveId: true,
        name: true,
        mimeType: true,
        size: true,
        ownerEmail: true,
        ownerName: true,
        createdTime: true,
        modifiedTime: true,
        webViewLink: true,
        trashed: true,
      },
    });
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json({ ...file, size: file.size != null ? Number(file.size) : null });
  } catch (err) {
    console.error("File get error:", err);
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// Rename file (updates Google Drive + local DB)
router.put("/:driveId", async (req, res) => {
  try {
    const { driveId } = req.params;
    if (!driveId) return res.status(400).json({ error: "Invalid ID" });

    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const file = await prisma.driveFile.findUnique({ where: { driveId } });
    if (!file) return res.status(404).json({ error: "File not found" });

    const auth = await getAuthenticatedClient(req.userEmail!);
    const drive = google.drive({ version: "v3", auth });
    await drive.files.update({
      fileId: driveId,
      requestBody: { name: name.trim() },
    });

    const { data } = await drive.files.get({
      fileId: driveId,
      fields: "modifiedTime",
    });

    const updated = await prisma.driveFile.update({
      where: { driveId },
      data: {
        name: name.trim(),
        modifiedTime: data.modifiedTime ? new Date(data.modifiedTime) : file.modifiedTime,
        lastSyncedAt: new Date(),
      },
      select: {
        id: true,
        driveId: true,
        name: true,
        mimeType: true,
        ownerEmail: true,
        modifiedTime: true,
        webViewLink: true,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("File rename error:", err);
    res.status(500).json({ error: "Failed to rename file" });
  }
});

// Delete file (trashes in Google Drive + marks trashed in local DB)
router.delete("/:driveId", async (req, res) => {
  try {
    const { driveId } = req.params;
    if (!driveId) return res.status(400).json({ error: "Invalid ID" });

    const file = await prisma.driveFile.findUnique({ where: { driveId } });
    if (!file) return res.status(404).json({ error: "File not found" });

    const auth = await getAuthenticatedClient(req.userEmail!);
    const drive = google.drive({ version: "v3", auth });
    await drive.files.update({
      fileId: driveId,
      requestBody: { trashed: true },
    });

    await prisma.driveFile.update({
      where: { driveId },
      data: { trashed: true, lastSyncedAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    console.error("File delete error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
