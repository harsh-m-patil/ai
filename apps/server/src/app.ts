import { createAiSdk, createOpenAICompatibleAdapter, type AiSdk, type ProviderAdapter } from "@ai/ai";
import { createDb, createConversation, listConversations, listMessages, continueConversation, migrate } from "@ai/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const testProvider: ProviderAdapter = {
  name: "test",
  defaultModel: "test-model",
  complete: async () => "I am a deterministic test response.",
};

export async function createApp(options?: {
  databaseUrl?: string;
  corsOrigin?: string;
  provider?: ProviderAdapter;
  aiSdk?: AiSdk;
  providerName?: string;
  model?: string;
}) {
  const app = new Hono();
  const db = createDb(options?.databaseUrl);
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY;
  const isOpenRouter = (process.env.OPENAI_BASE_URL ?? "").includes("openrouter.ai");
  const defaultProvider =
    process.env.NODE_ENV === "production" && apiKey
      ? createOpenAICompatibleAdapter({
          name: isOpenRouter ? "openrouter" : "openai",
          defaultModel: options?.model ?? (isOpenRouter ? "openai/gpt-4o" : "gpt-4o-mini"),
          apiKey,
          baseUrl: process.env.OPENAI_BASE_URL,
          defaultHeaders: isOpenRouter
            ? {
                ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
                ...(process.env.OPENROUTER_APP_NAME ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME } : {}),
              }
            : undefined,
        })
      : testProvider;
  const provider = options?.provider ?? defaultProvider;
  const aiSdk = options?.aiSdk ?? createAiSdk([provider]);
  const providerName = options?.providerName ?? provider.name;
  const model = options?.model ?? provider.defaultModel;

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

    try {
      const result = await continueConversation(db, conversationId, content, {
        provider: providerName,
        model,
        complete: (messages) =>
          aiSdk.complete(messages, {
            provider: providerName,
            model,
          }),
      });

      if (!result) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      return c.json(result, 201);
    } catch {
      return c.json({ error: "Inference failed" }, 500);
    }
  });

  return app;
}
