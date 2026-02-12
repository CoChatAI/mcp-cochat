import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

export const ProjectsSetContextSchema = z.object({
  system_prompt: z
    .string()
    .describe(
      "System prompt / project instructions. Injected into all chats in this project on CoChat."
    ),
  folder_id: z
    .string()
    .optional()
    .describe("Folder ID. If not provided, uses the current project."),
});

export type ProjectsSetContextInput = z.infer<typeof ProjectsSetContextSchema>;

export async function projectsSetContext(
  client: CoChatClient,
  input: ProjectsSetContextInput,
): Promise<string> {
  let folderId = input.folder_id;

  if (!folderId) {
    const project = await resolveCurrentProjectFolder(client);
    folderId = project.folderId;
  }

  await client.updateFolder(folderId, {
    data: { system_prompt: input.system_prompt },
  });

  return [
    `Project system prompt updated successfully.`,
    ``,
    `Folder ID: ${folderId}`,
    `Prompt length: ${input.system_prompt.length} characters`,
    ``,
    `This prompt will be injected into all new chats created in this project on CoChat.`,
  ].join("\n");
}
