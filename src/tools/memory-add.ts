import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

export const MemoryAddSchema = z.object({
  content: z
    .string()
    .describe(
      "Memory content to store. Design decisions, architectural patterns, " +
      "important context that should be available in CoChat conversations for this project."
    ),
});

export type MemoryAddInput = z.infer<typeof MemoryAddSchema>;

export async function memoryAdd(
  client: CoChatClient,
  input: MemoryAddInput,
): Promise<string> {
  const project = await resolveCurrentProjectFolder(client);
  const result = await client.addMemory(input.content, project.folderId);

  return [
    `Memory added successfully.`,
    ``,
    `Memory ID: ${result.id}`,
    `Project: ${project.projectName}`,
    `Content: ${input.content.length > 100 ? input.content.slice(0, 100) + "..." : input.content}`,
    ``,
    `This memory is now available in all CoChat conversations for this project.`,
  ].join("\n");
}
