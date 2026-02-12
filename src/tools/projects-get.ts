import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

export const ProjectsGetSchema = z.object({
  folder_id: z
    .string()
    .optional()
    .describe("Folder ID of the project. If not provided, uses the current project."),
});

export type ProjectsGetInput = z.infer<typeof ProjectsGetSchema>;

export async function projectsGet(
  client: CoChatClient,
  input: ProjectsGetInput,
): Promise<string> {
  let folderId = input.folder_id;

  if (!folderId) {
    const project = await resolveCurrentProjectFolder(client);
    folderId = project.folderId;
  }

  const folder = await client.getFolder(folderId);
  const data = folder.data as Record<string, unknown> | null;
  const systemPrompt = (data?.system_prompt as string) ?? "(not set)";
  const files = (data?.files as unknown[]) ?? [];

  const lines: string[] = [
    `## Project: ${folder.name}`,
    ``,
    `- Folder ID: ${folder.id}`,
    `- Collaborative: ${folder.is_collaborative}`,
    `- Link access: ${folder.link_access_level ?? "restricted"}`,
    `- Files: ${files.length}`,
    `- URL: ${client.folderUrl(folder.id)}`,
    ``,
    `### System Prompt`,
    ``,
    systemPrompt,
  ];

  return lines.join("\n");
}
