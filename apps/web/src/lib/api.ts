import { env } from "@tardis/env/web";

const BASE_URL = env.VITE_SERVER_URL;

export interface Conversation {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface Turn {
  id: string;
  conversationId: string;
  userMessageId: string;
  committedAssistantMessageId: string | null;
  status: "pending" | "completed" | "failed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
}

export interface InferenceRequest {
  id: string;
  turnId: string;
  attemptNumber: number;
  provider: string;
  model: string;
  status: "pending" | "streaming" | "completed" | "failed" | "cancelled";
  inputPreview: string | null;
  outputPreview: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ContinueConversationResult {
  message: Message;
  turn: Turn;
  inferenceRequest: InferenceRequest;
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await fetch(`${BASE_URL}/conversations`);
  if (!response.ok) {
    throw new Error(`Failed to list conversations: ${response.status}`);
  }
  const data = await response.json();
  return data.conversations;
}

export async function createConversation(): Promise<Conversation> {
  const response = await fetch(`${BASE_URL}/conversations`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.status}`);
  }
  const data = await response.json();
  return data.conversation;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`);
  if (!response.ok) {
    throw new Error(`Failed to list messages: ${response.status}`);
  }
  const data = await response.json();
  return data.messages;
}

export async function continueConversation(
  conversationId: string,
  content: string,
): Promise<ContinueConversationResult> {
  const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to continue conversation: ${response.status}`);
  }

  return response.json();
}

export async function continueConversationStream(
  conversationId: string,
  content: string,
  handlers: {
    onAssistantDelta: (delta: string) => void;
  },
): Promise<ContinueConversationResult> {
  const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream conversation: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: ContinueConversationResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      const event = JSON.parse(line) as
        | { type: "assistant_delta"; delta: string }
        | { type: "completed"; result: ContinueConversationResult }
        | { type: "error"; error: string };

      if (event.type === "assistant_delta") {
        handlers.onAssistantDelta(event.delta);
      }

      if (event.type === "completed") {
        completed = event.result;
      }

      if (event.type === "error") {
        throw new Error(event.error);
      }
    }
  }

  if (!completed) {
    throw new Error("Stream ended without completion payload");
  }

  return completed;
}
