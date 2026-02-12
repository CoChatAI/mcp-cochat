import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";

export const AutomationsTriggerSchema = z.object({
  automation_id: z.string().describe("ID of the automation to trigger"),
});

export type AutomationsTriggerInput = z.infer<typeof AutomationsTriggerSchema>;

export async function automationsTrigger(
  client: CoChatClient,
  input: AutomationsTriggerInput,
): Promise<string> {
  const run = await client.triggerAutomation(input.automation_id);

  return [
    `Automation triggered successfully.`,
    ``,
    `Run ID: ${run.id}`,
    `Status: ${run.status}`,
    `Started at: ${new Date(run.started_at * 1000).toISOString()}`,
  ].join("\n");
}
