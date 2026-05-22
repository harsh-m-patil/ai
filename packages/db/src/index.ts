import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import * as schema from "./schema";
import type { Message } from "./schema";

export type Db = ReturnType<typeof createDb>;

export type InferenceRuntime = {
  provider: string;
  model: string;
  complete: (messages: Pick<Message, "role" | "content">[]) => Promise<string>;
};

export function createDb(databaseUrl?: string) {
  const client = createClient({
    url: databaseUrl ?? process.env.DATABASE_URL ?? "file:local.db",
  });

  return drizzle({ client, schema });
}

async function fetchOne<T>(query: Promise<T[]>): Promise<T | undefined> {
  const [row] = await query;
  return row;
}

export async function migrate(db: ReturnType<typeof createDb>) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
      committed_assistant_message_id TEXT REFERENCES messages(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS inference_requests (
      id TEXT PRIMARY KEY NOT NULL,
      turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input_preview TEXT,
      output_preview TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT
    )
  `);
}

export async function listConversations(db: Db) {
  return db.select().from(schema.conversations).orderBy(desc(schema.conversations.createdAt));
}

export async function createConversation(db: Db) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.conversations).values({
    id,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return fetchOne(db.select().from(schema.conversations).where(eq(schema.conversations.id, id)));
}

export async function continueConversation(
  db: Db,
  conversationId: string,
  userContent: string,
  runtime: InferenceRuntime,
) {
  // 1. Verify conversation exists
  const conversation = await fetchOne(
    db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)),
  );

  if (!conversation) {
    return null;
  }

  const now = new Date().toISOString();

  // 2. Persist user message
  const userMessageId = randomUUID();
  await db.insert(schema.messages).values({
    id: userMessageId,
    conversationId,
    role: "user",
    content: userContent,
    createdAt: now,
  });

  // 3. Create pending turn
  const turnId = randomUUID();
  await db.insert(schema.turns).values({
    id: turnId,
    conversationId,
    userMessageId,
    status: "pending",
    createdAt: now,
  });

  // 4. Build history for inference
  const history = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId));

  const inferenceInput = history.map((m) => ({ role: m.role, content: m.content }));

  // 5. Create inference request record
  const inferenceRequestId = randomUUID();
  const startedAt = new Date().toISOString();
  await db.insert(schema.inferenceRequests).values({
    id: inferenceRequestId,
    turnId,
    provider: runtime.provider,
    model: runtime.model,
    status: "pending",
    inputPreview: userContent.slice(0, 200),
    startedAt,
  });

  let assistantMessageId: string | null = null;

  try {
    // 6. Invoke provider
    const assistantContent = await runtime.complete(inferenceInput);
    const endedAt = new Date().toISOString();

    // 7. Update inference request to completed
    await db
      .update(schema.inferenceRequests)
      .set({ status: "completed", outputPreview: assistantContent.slice(0, 200), endedAt })
      .where(eq(schema.inferenceRequests.id, inferenceRequestId));

    // 8. Persist committed assistant message
    assistantMessageId = randomUUID();
    await db.insert(schema.messages).values({
      id: assistantMessageId,
      conversationId,
      role: "assistant",
      content: assistantContent,
      createdAt: endedAt,
    });

    // 9. Complete the turn
    await db
      .update(schema.turns)
      .set({ status: "completed", committedAssistantMessageId: assistantMessageId, completedAt: endedAt })
      .where(eq(schema.turns.id, turnId));
  } catch (error) {
    const endedAt = new Date().toISOString();

    await db
      .update(schema.inferenceRequests)
      .set({ status: "failed", endedAt })
      .where(eq(schema.inferenceRequests.id, inferenceRequestId));

    await db
      .update(schema.turns)
      .set({ status: "failed", completedAt: endedAt })
      .where(eq(schema.turns.id, turnId));

    throw error;
  }

  // 10. Return assembled result
  const [turn, assistantMessage, inferenceRequest] = await Promise.all([
    fetchOne(db.select().from(schema.turns).where(eq(schema.turns.id, turnId))),
    assistantMessageId
      ? fetchOne(db.select().from(schema.messages).where(eq(schema.messages.id, assistantMessageId)))
      : Promise.resolve(undefined),
    fetchOne(db.select().from(schema.inferenceRequests).where(eq(schema.inferenceRequests.id, inferenceRequestId))),
  ]);

  return { turn, message: assistantMessage, inferenceRequest };
}

export async function listMessages(db: Db, conversationId: string) {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(schema.messages.createdAt);
}

export const db = createDb();

export { schema };
