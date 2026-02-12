import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";
import { getAskAutomationId, setAskAutomationId } from "../config.js";

export const CoChatAskSchema = z.object({
  question: z
    .string()
    .describe(
      "The question to ask CoChat. CoChat will answer using the project's " +
      "knowledge base, memories, and configured model."
    ),
  automation_id: z
    .string()
    .optional()
    .describe(
      "Specific automation ID to use. If not provided, auto-detects or creates " +
      "an 'MCP Ask' automation for the current project."
    ),
});

export type CoChatAskInput = z.infer<typeof CoChatAskSchema>;

const ASK_AUTOMATION_NAME = "MCP Ask";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;

/**
 * Find or create the "MCP Ask" automation for the current project.
 *
 * Lookup order:
 * 1. Explicit automation_id parameter
 * 2. Locally cached automation ID for this project
 * 3. Search existing automations by name convention
 * 4. Create a new one
 */
async function resolveAskAutomation(
  client: CoChatClient,
  folderId: string,
  overrideId?: string,
): Promise<string> {
  // 1. Explicit override
  if (overrideId) return overrideId;

  // 2. Locally cached
  const cached = getAskAutomationId(folderId);
  if (cached) {
    // Verify it still exists (might have been deleted in CoChat UI)
    try {
      const automations = await client.listAutomations();
      if (automations.some((a) => a.id === cached)) {
        return cached;
      }
    } catch {
      // Fall through to search/create
    }
  }

  // 3. Search by name convention
  const automations = await client.listAutomations();
  const existing = automations.find(
    (a) => a.name === ASK_AUTOMATION_NAME && a.folder_id === folderId,
  );
  if (existing) {
    setAskAutomationId(folderId, existing.id);
    return existing.id;
  }

  // 4. Create a new one
  const defaultModel = await client.getDefaultModel();

  const automation = await client.createAutomation({
    name: ASK_AUTOMATION_NAME,
    description:
      "Auto-created by MCP. Answers questions using the project's knowledge and memories.",
    folder_id: folderId,
    trigger_type: "manual",
    trigger_config: {},
    actions: [
      {
        id: crypto.randomUUID(),
        type: "prompt",
        config: {
          model_id: defaultModel,
          user_prompt: "{{input.question}}",
          system_prompt:
            "You are answering a question from a coding agent working on this project. " +
            "Use the project's memories and your knowledge to give a clear, concise answer. " +
            "Focus on being helpful and specific to this project's context.",
          features: { memory: true },
        },
      },
    ],
    is_enabled: true,
  });

  setAskAutomationId(folderId, automation.id);
  return automation.id;
}

/**
 * Poll for a completed run, returning the most recent run that started
 * after our trigger time.
 */
async function pollForResult(
  client: CoChatClient,
  automationId: string,
  startedAfter: number,
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const runs = await client.getAutomationRuns(automationId);

    // Find a run that started after our trigger
    const completedRun = runs.find(
      (r) =>
        r.started_at >= startedAfter &&
        (r.status === "completed" || r.status === "failed"),
    );

    if (completedRun) {
      if (completedRun.status === "failed") {
        return `CoChat automation failed: ${completedRun.error ?? "unknown error"}`;
      }

      // Extract the LLM answer from action_results
      const actionResults = completedRun.action_results;
      if (actionResults && actionResults.length > 0) {
        const firstResult = actionResults[0];
        if (firstResult && typeof firstResult === "object" && "output" in firstResult) {
          return String((firstResult as { output: unknown }).output);
        }
      }

      return "Automation completed but produced no output.";
    }
  }

  return (
    "The question was sent to CoChat but the response is still being generated. " +
    "You can check back later using automations_runs with the automation ID."
  );
}

export async function cochatAsk(
  client: CoChatClient,
  input: CoChatAskInput,
): Promise<string> {
  const project = await resolveCurrentProjectFolder(client);
  const automationId = await resolveAskAutomation(
    client,
    project.folderId,
    input.automation_id,
  );

  // Record time just before triggering (unix seconds, matching API timestamps)
  const triggeredAt = Math.floor(Date.now() / 1000) - 1;

  // Trigger with the question as input
  const triggerResult = await client.triggerAutomation(automationId, {
    question: input.question,
  });

  if (!triggerResult.success) {
    return `Failed to trigger ask automation: ${triggerResult.error ?? "unknown error"}`;
  }

  // Poll for the answer
  const answer = await pollForResult(client, automationId, triggeredAt);

  return answer;
}
