import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { getTrackedPlan, getMostRecentPlan, trackPlan } from "../config.js";
import { markdownToPlan, isPlanMessage } from "../plan-format.js";

export const PlansPullSchema = z.object({
  chat_id: z
    .string()
    .optional()
    .describe(
      "Chat ID of the plan to pull. If not provided, pulls the most recently shared plan."
    ),
});

export type PlansPullInput = z.infer<typeof PlansPullSchema>;

export async function plansPull(
  client: CoChatClient,
  input: PlansPullInput,
): Promise<string> {
  const chatId = input.chat_id;
  const tracked = chatId ? getTrackedPlan(chatId) : getMostRecentPlan();

  if (!tracked && !chatId) {
    return "No shared plans found. Use plans_share to share a plan first.";
  }

  const targetChatId = chatId ?? tracked!.chatId;

  const chat = await client.getChat(targetChatId);
  const messages = client.extractMessages(chat);

  if (messages.length === 0) {
    return `Chat ${targetChatId} has no messages.`;
  }

  // Find the plan message regardless of role (may be "user" from older plans
  // or "assistant" from newer ones)
  const planMessage = messages.find((m) => isPlanMessage(m.content));

  if (!planMessage) {
    return `Chat ${targetChatId} does not contain a plan created by this tool.`;
  }

  const plan = markdownToPlan(planMessage.content);

  const feedbackMessages = messages.filter((m) => m.id !== planMessage.id);

  if (tracked) {
    trackPlan({ ...tracked, updatedAt: new Date().toISOString() });
  }

  const parts: string[] = [];

  if (plan) {
    parts.push(`## Plan: ${plan.title}`);
    parts.push("");

    if (plan.description) {
      parts.push(plan.description);
      parts.push("");
    }

    parts.push("### Current Tasks");
    parts.push("");

    for (const item of plan.items) {
      const statusIcon =
        item.status === "completed"
          ? "[DONE]"
          : item.status === "in_progress"
            ? "[IN PROGRESS]"
            : item.status === "cancelled"
              ? "[CANCELLED]"
              : "[PENDING]";
      parts.push(`- ${statusIcon} (${item.priority}) ${item.content}`);
      if (item.children) {
        for (const child of item.children) {
          const childIcon = child.status === "completed" ? "[DONE]" : "[PENDING]";
          parts.push(`  - ${childIcon} (${child.priority}) ${child.content}`);
        }
      }
    }
  } else {
    parts.push("Could not parse the plan from the chat message.");
    parts.push("Raw plan message content:");
    parts.push(planMessage.content);
  }

  if (feedbackMessages.length > 0) {
    parts.push("");
    parts.push(`### Feedback (${feedbackMessages.length} message(s))`);
    parts.push("");

    for (const msg of feedbackMessages) {
      const authorName = msg.author?.name ?? msg.role;
      const time = new Date(msg.timestamp * 1000).toISOString();
      parts.push(`**${authorName}** (${time}):`);
      const content =
        msg.content.length > 500
          ? msg.content.slice(0, 500) + "..."
          : msg.content;
      parts.push(content);
      parts.push("");
    }
  } else {
    parts.push("");
    parts.push("### Feedback");
    parts.push("No feedback yet.");
  }

  parts.push("");
  parts.push(`Chat URL: ${client.chatUrl(targetChatId)}`);

  return parts.join("\n");
}
