import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma";
import type { Prisma } from "../generated/prisma/client";

const router: IRouter = Router();

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

    function parseDate(value: string): Date | null {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
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

export default router;
