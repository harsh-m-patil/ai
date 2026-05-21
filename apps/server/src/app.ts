import { createDb, createConversation, listConversations, migrate } from "@ai/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export async function createApp(options?: { databaseUrl?: string; corsOrigin?: string }) {
  const app = new Hono();
  const db = createDb(options?.databaseUrl);

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

  return app;
}
