import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";

export const AutomationsRunsSchema = z.object({
  automation_id: z.string().describe("ID of the automation to get run history for"),
});

export type AutomationsRunsInput = z.infer<typeof AutomationsRunsSchema>;

export async function automationsRuns(
  client: CoChatClient,
  input: AutomationsRunsInput,
): Promise<string> {
  const runs = await client.getAutomationRuns(input.automation_id);

  if (!runs || runs.length === 0) {
    return `No runs found for automation ${input.automation_id}.`;
  }

  const lines: string[] = [
    `## Run History (${runs.length} run(s))`,
    ``,
  ];

  for (const run of runs) {
    const started = new Date(run.started_at * 1000).toISOString();
    const completed = run.completed_at
      ? new Date(run.completed_at * 1000).toISOString()
      : "in progress";
    lines.push(`- **${run.id}**: ${run.status}`);
    lines.push(`  - Started: ${started} | Completed: ${completed}`);
    if (run.error) {
      lines.push(`  - Error: ${run.error}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}
