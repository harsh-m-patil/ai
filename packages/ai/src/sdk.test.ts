import { describe, expect, it } from "vitest";

import { createAiSdk, type ProviderAdapter } from "./index";

describe("AI SDK", () => {
  it("returns buffered text from a registered provider adapter", async () => {
    const provider: ProviderAdapter = {
      name: "test",
      defaultModel: "test-model",
      complete: async () => "hello from adapter",
    };
    const sdk = createAiSdk([provider]);

    const result = await sdk.complete([{ role: "user", content: "Hi" }], {
      provider: "test",
    });

    expect(result).toBe("hello from adapter");
  });

  it("throws when provider is not registered", async () => {
    const sdk = createAiSdk();

    await expect(
      sdk.complete([{ role: "user", content: "Hi" }], {
        provider: "missing",
      }),
    ).rejects.toThrow("is not registered");
  });
});
