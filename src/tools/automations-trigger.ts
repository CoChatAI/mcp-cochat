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
  const result = await client.triggerAutomation(input.automation_id);

  if (!result.success) {
    return `Failed to trigger automation: ${result.error ?? "unknown error"}`;
  }

  return [
    `Automation triggered successfully.`,
    ``,
    `Message: ${result.message ?? "Automation triggered"}`,
  ].join("\n");
}
