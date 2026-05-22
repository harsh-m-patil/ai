import OpenAI from "openai";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type CompleteOptions = {
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type ProviderCompleteOptions = {
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export type ProviderAdapter = {
  name: string;
  defaultModel: string;
  complete: (messages: ChatMessage[], options: ProviderCompleteOptions) => Promise<string>;
};

export type ProviderRegistry = {
  register: (provider: ProviderAdapter) => void;
  resolve: (name: string) => ProviderAdapter | undefined;
};

export type AiSdk = {
  registerProvider: (provider: ProviderAdapter) => void;
  complete: (messages: ChatMessage[], options: CompleteOptions) => Promise<string>;
};

export function createProviderRegistry(initialProviders: ProviderAdapter[] = []): ProviderRegistry {
  const providers = new Map<string, ProviderAdapter>();

  for (const provider of initialProviders) {
    providers.set(provider.name, provider);
  }

  return {
    register(provider) {
      providers.set(provider.name, provider);
    },
    resolve(name) {
      return providers.get(name);
    },
  };
}

export function createAiSdk(initialProviders: ProviderAdapter[] = []): AiSdk {
  const registry = createProviderRegistry(initialProviders);

  return {
    registerProvider(provider) {
      registry.register(provider);
    },
    async complete(messages, options) {
      const provider = registry.resolve(options.provider);

      if (!provider) {
        throw new Error(`Provider '${options.provider}' is not registered`);
      }

      return provider.complete(messages, {
        model: options.model ?? provider.defaultModel,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
    },
  };
}

export type OpenAICompatibleAdapterOptions = {
  name: string;
  defaultModel: string;
  apiKey?: string;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  fetchFn?: typeof fetch;
};

function toOpenAiSdkBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export function createOpenAICompatibleAdapter(options: OpenAICompatibleAdapterOptions): ProviderAdapter {
  const baseUrl = options.baseUrl ?? "https://api.openai.com";

  return {
    name: options.name,
    defaultModel: options.defaultModel,
    async complete(messages, config) {
      const apiKey = options.apiKey ?? process.env[options.apiKeyEnvVar ?? "OPENAI_API_KEY"];

      if (!apiKey) {
        throw new Error(`Missing API key for provider '${options.name}'`);
      }

      const client = new OpenAI({
        apiKey,
        baseURL: toOpenAiSdkBaseUrl(baseUrl),
        defaultHeaders: options.defaultHeaders,
        fetch: options.fetchFn,
      });

      const completion = await client.chat.completions.create({
        model: config.model,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      });

      const content = completion.choices?.[0]?.message?.content;

      if (typeof content !== "string") {
        throw new Error("OpenAI-compatible response missing assistant content");
      }

      return content;
    },
  };
}
