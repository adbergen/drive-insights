import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  if (!req.userEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const base = { trashed: false, userEmail: req.userEmail };

    const [totalFiles, sizeAgg, typeGroups, ownerGroups, modifiedDates] =
      await Promise.all([
        prisma.driveFile.count({ where: base }),
        prisma.driveFile.aggregate({ where: base, _sum: { size: true } }),
        prisma.driveFile.groupBy({
          by: ["mimeType"],
          where: base,
          _count: { mimeType: true },
          _sum: { size: true },
          orderBy: { _count: { mimeType: "desc" } },
          take: 6,
        }),
        prisma.driveFile.groupBy({
          by: ["ownerEmail"],
          where: { ...base, ownerEmail: { not: null } },
          _count: { ownerEmail: true },
          orderBy: { _count: { ownerEmail: "desc" } },
          take: 6,
        }),
        // Month aggregation stays in-memory (Prisma doesn't support date_trunc)
        prisma.driveFile.findMany({
          where: base,
          select: { modifiedTime: true },
        }),
      ]);

    const totalSize = Number(sizeAgg._sum.size ?? 0);

    const uniqueOwners = await prisma.driveFile.groupBy({
      by: ["ownerEmail"],
      where: { ...base, ownerEmail: { not: null } },
    });

    const topTypes = typeGroups.map((g) => ({
      type: g.mimeType,
      count: g._count.mimeType,
    }));

    const topOwners = ownerGroups.map((g) => ({
      owner: g.ownerEmail!,
      count: g._count.ownerEmail,
    }));

    const storageByType = typeGroups
      .filter((g) => g._sum.size !== null)
      .sort((a, b) => {
        const aSize = a._sum.size ?? 0n;
        const bSize = b._sum.size ?? 0n;
        return bSize > aSize ? 1 : bSize < aSize ? -1 : 0;
      })
      .map((g) => ({
        type: g.mimeType,
        bytes: Number(g._sum.size ?? 0),
      }));

    const monthCounts: Record<string, number> = {};
    for (const { modifiedTime } of modifiedDates) {
      if (modifiedTime) {
        const month = modifiedTime.toISOString().slice(0, 7);
        monthCounts[month] = (monthCounts[month] ?? 0) + 1;
      }
    }
    const activityByMonth = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    res.json({
      totalFiles,
      totalSize,
      uniqueOwners: uniqueOwners.length,
      topTypes,
      topOwners,
      storageByType,
      activityByMonth,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to compute analytics" });
  }
});

export default router;
