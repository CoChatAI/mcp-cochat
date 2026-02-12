import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { getTrackedPlan, trackPlan } from "../config.js";
import { planToMarkdown, isPlanMessage } from "../plan-format.js";
import { PlanItemSchema } from "../schemas.js";

export const PlansUpdateSchema = z.object({
  chat_id: z.string().describe("Chat ID of the plan to update"),
  items: z.array(PlanItemSchema).describe("Updated list of plan task items"),
  description: z.string().optional().describe("Updated description"),
});

export type PlansUpdateInput = z.infer<typeof PlansUpdateSchema>;

export async function plansUpdate(
  client: CoChatClient,
  input: PlansUpdateInput,
): Promise<string> {
  const tracked = getTrackedPlan(input.chat_id);

  if (!tracked) {
    return `Plan with chat ID ${input.chat_id} is not tracked locally. Use plans_list to see tracked plans.`;
  }

  const chat = await client.getChat(input.chat_id);
  const messages = client.extractMessages(chat);

  const planMessage = messages.find((m) => isPlanMessage(m.content));

  if (!planMessage) {
    return `Chat ${input.chat_id} does not contain a plan message.`;
  }

  const now = new Date().toISOString();

  const plan = {
    title: tracked.title,
    description: input.description,
    items: input.items,
    metadata: {
      source: "coding-agent",
      createdAt: tracked.createdAt,
      updatedAt: now,
    },
  };

  const markdown = planToMarkdown(plan);

  await client.updateMessage(input.chat_id, tracked.planMessageId, markdown);

  trackPlan({ ...tracked, updatedAt: now });

  return [
    `Plan "${tracked.title}" updated successfully.`,
    ``,
    `Chat URL: ${tracked.url}`,
    `Updated ${input.items.length} task(s).`,
  ].join("\n");
}
