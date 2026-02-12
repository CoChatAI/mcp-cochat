import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CoChatClient } from "../cochat-client.js";
import { loadStore } from "../config.js";
import { isPlanMessage } from "../plan-format.js";

// ---------------------------------------------------------------------------
// Subscription polling state
// ---------------------------------------------------------------------------

interface SubscriptionState {
  chatId: string;
  lastUpdatedAt: number;
  intervalId: ReturnType<typeof setInterval>;
}

const subscriptions = new Map<string, SubscriptionState>();

const POLL_INTERVAL_MS = 10_000; // 10 seconds

// ---------------------------------------------------------------------------
// URI helpers
// ---------------------------------------------------------------------------

export function planUri(chatId: string): string {
  return `cochat://plan/${chatId}`;
}

function chatIdFromUri(uri: string): string | null {
  const match = uri.match(/^cochat:\/\/plan\/(.+)$/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// List resources: one per tracked plan
// ---------------------------------------------------------------------------

export function listPlanResources() {
  const store = loadStore();
  return Object.values(store.plans).map((plan) => ({
    uri: planUri(plan.chatId),
    name: `Plan: ${plan.title}`,
    description: `Shared plan "${plan.title}" in CoChat`,
    mimeType: "text/markdown",
  }));
}

// ---------------------------------------------------------------------------
// Read resource: fetch plan content from CoChat
// ---------------------------------------------------------------------------

export async function readPlanResource(
  uri: string,
  client: CoChatClient,
): Promise<{ uri: string; mimeType: string; text: string } | null> {
  const chatId = chatIdFromUri(uri);
  if (!chatId) return null;

  const chat = await client.getChat(chatId);
  const messages = client.extractMessages(chat);

  const planMessage = messages.find((m) => isPlanMessage(m.content));

  if (!planMessage) {
    return {
      uri,
      mimeType: "text/plain",
      text: "No plan found in this chat.",
    };
  }

  return {
    uri,
    mimeType: "text/markdown",
    text: planMessage.content,
  };
}

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe: poll CoChat for changes
// ---------------------------------------------------------------------------

export function subscribeToPlan(
  uri: string,
  client: CoChatClient,
  server: Server,
): boolean {
  const chatId = chatIdFromUri(uri);
  if (!chatId) return false;

  // Don't double-subscribe
  if (subscriptions.has(uri)) return true;

  const intervalId = setInterval(async () => {
    try {
      const chat = await client.getChat(chatId);
      const state = subscriptions.get(uri);
      if (!state) return;

      if (chat.updated_at !== state.lastUpdatedAt) {
        state.lastUpdatedAt = chat.updated_at;
        // Emit resource updated notification
        await server.notification({
          method: "notifications/resources/updated",
          params: { uri },
        });
      }
    } catch {
      // Silently ignore polling errors
    }
  }, POLL_INTERVAL_MS);

  subscriptions.set(uri, {
    chatId,
    lastUpdatedAt: 0,
    intervalId,
  });

  return true;
}

export function unsubscribeFromPlan(uri: string): boolean {
  const state = subscriptions.get(uri);
  if (!state) return false;

  clearInterval(state.intervalId);
  subscriptions.delete(uri);
  return true;
}

export function cleanupSubscriptions(): void {
  for (const [, state] of subscriptions) {
    clearInterval(state.intervalId);
  }
  subscriptions.clear();
}
