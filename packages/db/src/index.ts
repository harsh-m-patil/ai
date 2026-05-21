import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import * as schema from "./schema";

export function createDb(databaseUrl?: string) {
  const client = createClient({
    url: databaseUrl ?? process.env.DATABASE_URL ?? "file:local.db",
  });

  return drizzle({ client, schema });
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
}

export async function listConversations(db: ReturnType<typeof createDb>) {
  return db.select().from(schema.conversations).orderBy(desc(schema.conversations.createdAt));
}

export async function createConversation(db: ReturnType<typeof createDb>) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.conversations).values({
    id,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const [conversation] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id));

  return conversation;
}

export const db = createDb();

export { schema };
