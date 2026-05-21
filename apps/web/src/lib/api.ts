import { env } from "@ai/env/web";

const BASE_URL = env.VITE_SERVER_URL;

export interface Conversation {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
