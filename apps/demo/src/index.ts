import { createAiSdk, createOpenAICompatibleAdapter } from "@tardis/ai";

const prompt = process.argv.slice(2).filter((arg) => arg !== "--").join(" ") || "Explain AI in 5 words";

const sdk = createAiSdk([
  createOpenAICompatibleAdapter({
    name: "openrouter",
    defaultModel: process.env.OPENROUTER_MODEL ?? process.env.OPENAI_MODEL ?? "openai/gpt-4o-mini",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
  }),
]);

const response = await sdk.complete([{ role: "user", content: prompt }], {
  provider: "openrouter",
});

console.log(response);
