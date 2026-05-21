import { createDb, createConversation, listConversations, listMessages, continueConversation, migrate, type Provider } from "@ai/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const testProvider: Provider = {
  name: "test",
  model: "test-model",
  complete: async () => "I am a deterministic test response.",
};

export async function createApp(options?: { databaseUrl?: string; corsOrigin?: string; provider?: Provider }) {
  const app = new Hono();
  const db = createDb(options?.databaseUrl);
  const provider = options?.provider ?? testProvider;

  await migrate(db);

  app.use(logger());
  app.use(
    "/*",
    cors({
      origin: options?.corsOrigin ?? "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/", (c) => {
    return c.text("OK");
  });

  app.get("/conversations", async (c) => {
    const conversations = await listConversations(db);

    return c.json({ conversations });
  });

  app.post("/conversations", async (c) => {
    const conversation = await createConversation(db);

    return c.json({ conversation }, 201);
  });

  app.get("/conversations/:id/messages", async (c) => {
    const conversationId = c.req.param("id");
    const messages = await listMessages(db, conversationId);
    return c.json({ messages });
  });

  app.post("/conversations/:id/messages", async (c) => {
    const conversationId = c.req.param("id");
    const { content } = await c.req.json<{ content: string }>();

    const result = await continueConversation(db, conversationId, content, provider);

    if (!result) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json(result, 201);
  });

  return app;
}
