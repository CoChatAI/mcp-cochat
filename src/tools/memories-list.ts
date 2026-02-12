import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

export async function memoryList(client: CoChatClient): Promise<string> {
  const project = await resolveCurrentProjectFolder(client);
  const memories = await client.listMemories(project.folderId);

  if (!memories || memories.length === 0) {
    return `No memories found for project "${project.projectName}".`;
  }

  const lines: string[] = [
    `## Project Memories (${memories.length})`,
    ``,
    `Project: ${project.projectName}`,
    ``,
  ];

  const sorted = [...memories].sort((a, b) => b.updated_at - a.updated_at);

  for (const mem of sorted) {
    const date = new Date(mem.updated_at * 1000).toISOString().split("T")[0];
    const preview =
      mem.content.length > 120
        ? mem.content.slice(0, 120) + "..."
        : mem.content;
    lines.push(`- **${mem.id}** (${date}): ${preview}`);
  }

  return lines.join("\n");
}
