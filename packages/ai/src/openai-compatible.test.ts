import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createOpenAICompatibleAdapter } from "./index";

describe("OpenAI-compatible adapter", () => {
  let lastRequest:
    | {
        method?: string;
        url?: string;
        headers?: Record<string, string | string[] | undefined>;
        body?: unknown;
      }
    | undefined;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    lastRequest = undefined;

    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        lastRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: JSON.parse(body),
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: "stubbed assistant response" } }],
          }),
        );
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind stub server");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("calls /v1/chat/completions with bearer auth and request body", async () => {
    const adapter = createOpenAICompatibleAdapter({
      name: "openai",
      defaultModel: "gpt-4o-mini",
      apiKey: "test-api-key",
      baseUrl,
    });

    const result = await adapter.complete(
      [{ role: "user", content: "hello" }],
      { model: "gpt-4o-mini", temperature: 0.2, maxTokens: 123 },
    );

    expect(result).toBe("stubbed assistant response");
    expect(lastRequest).toBeDefined();
    expect(lastRequest?.method).toBe("POST");
    expect(lastRequest?.url).toBe("/v1/chat/completions");
    expect(lastRequest?.headers?.authorization).toBe("Bearer test-api-key");
    expect(lastRequest?.body).toMatchObject({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.2,
      max_tokens: 123,
    });
  });

  it("does not append /v1 twice when baseUrl already includes version", async () => {
    const adapter = createOpenAICompatibleAdapter({
      name: "openrouter",
      defaultModel: "openai/gpt-4o",
      apiKey: "test-openrouter-key",
      baseUrl: `${baseUrl}/api/v1`,
      defaultHeaders: {
        "HTTP-Referer": "https://example.com",
        "X-OpenRouter-Title": "AI Demo",
      },
    });

    const result = await adapter.complete([{ role: "user", content: "hello" }], {
      model: "openai/gpt-4o",
    });

    expect(result).toBe("stubbed assistant response");
    expect(lastRequest?.url).toBe("/api/v1/chat/completions");
    expect(lastRequest?.headers?.authorization).toBe("Bearer test-openrouter-key");
    expect(lastRequest?.headers?.["http-referer"]).toBe("https://example.com");
    expect(lastRequest?.headers?.["x-openrouter-title"]).toBe("AI Demo");
  });
});
