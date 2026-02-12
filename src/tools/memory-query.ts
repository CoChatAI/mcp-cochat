import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

export const MemoryQuerySchema = z.object({
  query: z.string().describe("Search query for semantic memory search"),
  count: z
    .number()
    .optional()
    .describe("Number of results to return (default 5)"),
});

export type MemoryQueryInput = z.infer<typeof MemoryQuerySchema>;

export async function memoryQuery(
  client: CoChatClient,
  input: MemoryQueryInput,
): Promise<string> {
  const project = await resolveCurrentProjectFolder(client);
  const results = await client.queryMemories(
    input.query,
    input.count ?? 5,
    project.folderId,
  );

  if (!results || results.length === 0) {
    return `No memories found for query: "${input.query}"`;
  }

  const lines: string[] = [
    `## Memory Search Results (${results.length})`,
    ``,
    `Query: "${input.query}"`,
    `Project: ${project.projectName}`,
    ``,
  ];

  for (const mem of results) {
    const date = new Date(mem.updated_at * 1000).toISOString().split("T")[0];
    lines.push(`### Memory ${mem.id}`);
    lines.push(`Date: ${date}`);
    lines.push(``);
    lines.push(mem.content);
    lines.push(``);
  }

  return lines.join("\n");
}
