import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "./app";

describe("Conversation API", () => {
  let directory: string;
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "ai-server-test-"));
    const databaseUrl = `file:${join(directory, "test.db")}`;
    app = await createApp({ databaseUrl });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("GET /conversations returns an empty list when no Conversation exists", async () => {
    const response = await app.request("/conversations");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ conversations: [] });
  });

  it("POST /conversations creates a Conversation and returns it", async () => {
    const createResponse = await app.request("/conversations", {
      method: "POST",
    });

    expect(createResponse.status).toBe(201);
    const body = await createResponse.json();
    expect(body.conversation).toMatchObject({
      id: expect.any(String),
      status: "active",
    });
    expect(body.conversation.createdAt).toBeDefined();

    // Verify it shows up in the list
    const listResponse = await app.request("/conversations");
    const listBody = await listResponse.json();
    expect(listBody.conversations).toHaveLength(1);
    expect(listBody.conversations[0].id).toBe(body.conversation.id);
  });

  it("GET /conversations returns multiple Conversations ordered by most recent first", async () => {
    const res1 = await app.request("/conversations", { method: "POST" });
    const { conversation: first } = await res1.json();

    const res2 = await app.request("/conversations", { method: "POST" });
    const { conversation: second } = await res2.json();

    const listResponse = await app.request("/conversations");
    const { conversations } = await listResponse.json();

    expect(conversations).toHaveLength(2);
    expect(conversations[0].id).toBe(second.id);
    expect(conversations[1].id).toBe(first.id);
  });
});
