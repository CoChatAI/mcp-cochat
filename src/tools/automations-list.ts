import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

export async function automationsList(client: CoChatClient): Promise<string> {
  const project = await resolveCurrentProjectFolder(client);
  const allAutomations = await client.listAutomations();

  // Filter to current project
  const automations = allAutomations.filter(
    (a) => a.folder_id === project.folderId,
  );

  if (automations.length === 0) {
    // Also show unscoped automations
    const unscoped = allAutomations.filter((a) => !a.folder_id);
    if (unscoped.length === 0) {
      return `No automations found for project "${project.projectName}" or unscoped.`;
    }

    const lines: string[] = [
      `No automations found for project "${project.projectName}".`,
      ``,
      `### Unscoped Automations (${unscoped.length})`,
      ``,
    ];

    for (const auto of unscoped) {
      const status = auto.is_enabled ? "enabled" : "disabled";
      const lastRun = auto.last_run_at
        ? new Date(auto.last_run_at * 1000).toISOString()
        : "never";
      lines.push(`- **${auto.name}** (${auto.id})`);
      lines.push(`  - Trigger: ${auto.trigger_type} | Status: ${status}`);
      lines.push(`  - Last run: ${lastRun}`);
      if (auto.description) lines.push(`  - ${auto.description}`);
      lines.push(``);
    }

    return lines.join("\n");
  }

  const lines: string[] = [
    `## Automations for ${project.projectName} (${automations.length})`,
    ``,
  ];

  for (const auto of automations) {
    const status = auto.is_enabled ? "enabled" : "disabled";
    const lastRun = auto.last_run_at
      ? new Date(auto.last_run_at * 1000).toISOString()
      : "never";
    const nextRun = auto.next_run_at
      ? new Date(auto.next_run_at * 1000).toISOString()
      : "N/A";
    lines.push(`- **${auto.name}** (${auto.id})`);
    lines.push(`  - Trigger: ${auto.trigger_type} | Status: ${status}`);
    lines.push(`  - Last run: ${lastRun} | Next run: ${nextRun}`);
    if (auto.description) lines.push(`  - ${auto.description}`);
    lines.push(``);
  }

  return lines.join("\n");
}
