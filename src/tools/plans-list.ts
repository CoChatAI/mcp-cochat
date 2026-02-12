import type { CoChatClient } from "../cochat-client.js";
import { loadStore } from "../config.js";
import { isPlanMessage } from "../plan-format.js";

export async function plansList(client: CoChatClient): Promise<string> {
  const store = loadStore();
  const entries = Object.values(store.plans);

  if (entries.length === 0) {
    return "No shared plans tracked. Use plans_share to share a plan first.";
  }

  // Group plans by project
  const byProject = new Map<string, typeof entries>();
  for (const plan of entries) {
    const projectName = plan.folderId
      ? Object.values(store.projects).find((p) => p.folderId === plan.folderId)?.projectName ?? "Unknown Project"
      : "Unscoped";
    const group = byProject.get(projectName) ?? [];
    group.push(plan);
    byProject.set(projectName, group);
  }

  const lines: string[] = [`## Shared Plans (${entries.length})\n`];

  for (const [projectName, plans] of byProject) {
    lines.push(`### ${projectName}\n`);

    const sorted = plans.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    for (const plan of sorted) {
      let feedbackCount = 0;
      try {
        const chat = await client.getChat(plan.chatId);
        const messages = client.extractMessages(chat);
        feedbackCount = messages.filter(
          (m) => !isPlanMessage(m.content),
        ).length;
      } catch {
        // ignore fetch errors
      }

      lines.push(`- **${plan.title}**`);
      lines.push(`  - Chat ID: ${plan.chatId}`);
      lines.push(`  - URL: ${plan.url}`);
      lines.push(`  - Updated: ${plan.updatedAt}`);
      lines.push(`  - Feedback: ${feedbackCount} message(s)`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
