import OpenAI from "openai";

let client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}
