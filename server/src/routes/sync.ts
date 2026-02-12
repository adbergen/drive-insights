import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma";
import { syncDriveFiles } from "../services/drive-sync";

const router: IRouter = Router();

// Trigger a full Drive file sync
router.post("/", async (req, res) => {
  try {
    const { synced } = await syncDriveFiles(req.userEmail!);

    const aggregate = await prisma.driveFile.aggregate({
      where: { userEmail: req.userEmail! },
      _max: { lastSyncedAt: true },
    });

    res.json({
      synced,
      lastSyncedAt: aggregate._max.lastSyncedAt ?? null,
    });
  } catch (err) {
    console.error("Sync error:", err);
    const message = err instanceof Error ? err.message : "Drive sync failed";
    res.status(500).json({ error: message });
  }
});

// Get sync status (file count and last sync time)
router.get("/status", async (req, res) => {
  try {
    const where = { userEmail: req.userEmail! };
    const [count, aggregate] = await Promise.all([
      prisma.driveFile.count({ where }),
      prisma.driveFile.aggregate({ where, _max: { lastSyncedAt: true } }),
    ]);

    res.json({
      fileCount: count,
      lastSyncedAt: aggregate._max.lastSyncedAt ?? null,
    });
  } catch (err) {
    console.error("Sync status error:", err);
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

export default router;
