import OpenAI from "openai";
import { prisma } from "../lib/prisma";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

type Intent =
  | { type: "search"; query: string }
  | { type: "filter_date"; from?: string; to?: string }
  | { type: "filter_type"; mimeType: string }
  | { type: "filter_owner"; owner: string }
  | { type: "sort"; sortBy: string; order: "asc" | "desc"; limit: number }
  | { type: "count"; filter?: string }
  | { type: "summary" };

export interface QueryResult {
  files: Array<Record<string, unknown>>;
  total?: number;
  stats?: Record<string, unknown>;
}

// --- Step 1: Classify user intent via OpenAI ---

export async function classifyIntent(question: string): Promise<Intent> {
  const today = new Date().toISOString().split("T")[0];

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You classify questions about Google Drive files into structured queries.

Database fields: name, mimeType, size (bytes), ownerEmail, ownerName, createdTime, modifiedTime.

Common MIME types:
- application/vnd.google-apps.document (Google Doc)
- application/vnd.google-apps.spreadsheet (Google Sheet)
- application/vnd.google-apps.presentation (Google Slides)
- application/vnd.google-apps.folder (Folder)
- application/pdf (PDF)

Respond with ONLY a JSON object: { type, ...params }

Types and params:
- "search": { query: string }
- "filter_date": { from?: ISO date, to?: ISO date }
- "filter_type": { mimeType: string }
- "filter_owner": { owner: string }
- "sort": { sortBy: "size"|"modifiedTime"|"createdTime"|"name", order: "asc"|"desc", limit: number }
- "count": { filter?: string }
- "summary": {}

Today is ${today}. Calculate dates for relative terms like "last week".`,
      },
      { role: "user", content: question },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(content);

  // Handle { type: "sort", ...params }
  let type = parsed.type ?? parsed.intent ?? parsed.action;
  let params = parsed;

  // Handle { "sort": { sortBy: ..., ... } } — type as key with nested params
  if (!type) {
    const keys = Object.keys(parsed);
    if (keys.length === 1 && VALID_INTENTS.has(keys[0])) {
      type = keys[0];
      params = parsed[keys[0]];
    }
  }

  if (!type || !VALID_INTENTS.has(type)) {
    console.warn("Invalid intent, falling back to summary:", parsed);
    return { type: "summary" };
  }
  return { ...params, type } as Intent;
}

// --- Step 2: Execute classified intent against the database ---

const FILE_SELECT = {
  id: true,
  driveId: true,
  name: true,
  mimeType: true,
  size: true,
  ownerEmail: true,
  ownerName: true,
  modifiedTime: true,
  webViewLink: true,
} as const;

function serialize(
  files: Array<{ size: bigint | null; [key: string]: unknown }>,
) {
  return files.map((file) => ({
    ...file,
    size: file.size != null ? Number(file.size) : null,
  }));
}

const VALID_INTENTS = new Set([
  "search",
  "filter_date",
  "filter_type",
  "filter_owner",
  "sort",
  "count",
  "summary",
]);

export async function executeIntent(intent: Intent, userEmail: string): Promise<QueryResult> {
  if (!VALID_INTENTS.has(intent.type)) {
    throw new Error(`Unknown intent type: ${intent.type}`);
  }

  const base = { trashed: false, userEmail };

  switch (intent.type) {
    case "search": {
      const files = await prisma.driveFile.findMany({
        where: {
          ...base,
          name: { contains: intent.query, mode: "insensitive" },
        },
        select: FILE_SELECT,
        take: 20,
        orderBy: { modifiedTime: "desc" },
      });
      return { files: serialize(files) };
    }

    case "filter_date": {
      const dateWhere: Record<string, Date> = {};
      if (intent.from) {
        const parsedDate = new Date(intent.from);
        if (!isNaN(parsedDate.getTime())) dateWhere.gte = parsedDate;
      }
      if (intent.to) {
        const parsedDate = new Date(intent.to);
        if (!isNaN(parsedDate.getTime())) dateWhere.lte = parsedDate;
      }
      const files = await prisma.driveFile.findMany({
        where: { ...base, modifiedTime: dateWhere },
        select: FILE_SELECT,
        take: 20,
        orderBy: { modifiedTime: "desc" },
      });
      return { files: serialize(files) };
    }

    case "filter_type": {
      const files = await prisma.driveFile.findMany({
        where: {
          ...base,
          mimeType: { contains: intent.mimeType, mode: "insensitive" },
        },
        select: FILE_SELECT,
        take: 20,
        orderBy: { modifiedTime: "desc" },
      });
      return { files: serialize(files) };
    }

    case "filter_owner": {
      const files = await prisma.driveFile.findMany({
        where: {
          ...base,
          OR: [
            { ownerEmail: { contains: intent.owner, mode: "insensitive" } },
            { ownerName: { contains: intent.owner, mode: "insensitive" } },
          ],
        },
        select: FILE_SELECT,
        take: 20,
        orderBy: { modifiedTime: "desc" },
      });
      return { files: serialize(files) };
    }

    case "sort": {
      const allowed = ["size", "modifiedTime", "createdTime", "name"];
      const sortField = allowed.includes(intent.sortBy)
        ? intent.sortBy
        : "modifiedTime";
      const files = await prisma.driveFile.findMany({
        where: base,
        select: FILE_SELECT,
        take: Math.min(intent.limit || 10, 20),
        orderBy: {
          [sortField]: intent.order === "asc" ? "asc" : "desc",
        },
      });
      return { files: serialize(files) };
    }

    case "count": {
      const where = intent.filter
        ? {
            ...base,
            name: {
              contains: intent.filter,
              mode: "insensitive" as const,
            },
          }
        : base;
      const total = await prisma.driveFile.count({ where });
      return { files: [], total };
    }

    case "summary": {
      const allFiles = await prisma.driveFile.findMany({
        where: base,
        select: { mimeType: true, ownerEmail: true, modifiedTime: true },
      });

      const typeCounts: Record<string, number> = {};
      const ownerCounts: Record<string, number> = {};
      const dateCounts: Record<string, number> = {};
      for (const file of allFiles) {
        typeCounts[file.mimeType] = (typeCounts[file.mimeType] ?? 0) + 1;
        if (file.ownerEmail)
          ownerCounts[file.ownerEmail] = (ownerCounts[file.ownerEmail] ?? 0) + 1;
        if (file.modifiedTime) {
          const month = file.modifiedTime.toISOString().slice(0, 7);
          dateCounts[month] = (dateCounts[month] ?? 0) + 1;
        }
      }

      const topTypes = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      const topOwners = Object.entries(ownerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([owner, count]) => ({ owner, count }));

      const dateDistribution = Object.entries(dateCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

      const uniqueOwners = Object.keys(ownerCounts).length;

      return {
        files: [],
        total: allFiles.length,
        stats: { topTypes, topOwners, uniqueOwners, dateDistribution },
      };
    }
  }
}

// --- Step 3: Generate natural language answer ---

export async function generateAnswer(
  question: string,
  result: QueryResult,
): Promise<string> {
  // Strip webViewLink — the AI doesn't need URLs to answer questions
  const sanitized = {
    ...result,
    files: result.files.map(({ webViewLink: _, ...rest }) => rest),
  };

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You answer questions about Google Drive files based on query results. Be concise (2-3 sentences). The results may contain a files array and/or a stats object with topTypes, topOwners, uniqueOwners, and dateDistribution. Use all available data to answer the question. Only use data from the provided results — do not invent or assume information. Never include links or URLs in your response.",
      },
      {
        role: "user",
        content: `Question: ${question}\n\nQuery results: ${JSON.stringify(sanitized)}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  return (
    response.choices[0]?.message?.content ?? "I couldn't generate an answer."
  );
}
