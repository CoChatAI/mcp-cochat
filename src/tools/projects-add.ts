import { z } from "zod";
import type { CoChatClient, CoChatFolderResponse } from "../cochat-client.js";
import { getProjectMapping, setProjectMapping } from "../config.js";
import { log } from "../logger.js";
import { resolveProjectName, resolveProjectPath } from "../project.js";

export const ProjectsAddSchema = z.object({
  name: z
    .string()
    .optional()
    .describe(
      "Project name. If not provided, auto-detected from git remote or directory name."
    ),
});

export type ProjectsAddInput = z.infer<typeof ProjectsAddSchema>;

export interface ResolvedProject {
  folderId: string;
  projectName: string;
  projectPath: string;
  folderUrl: string;
  created: boolean;
}

/**
 * Resolve the current project's CoChat folder. Used by other tools (e.g., plans_share)
 * to lazily create the project folder when needed.
 */
export async function resolveCurrentProjectFolder(
  client: CoChatClient,
  overrideName?: string,
): Promise<ResolvedProject> {
  const projectPath = resolveProjectPath();
  const projectName = overrideName ?? resolveProjectName();
  log.info(`resolveProject: path="${projectPath}" name="${projectName}"`);

  // Check local cache
  const existing = getProjectMapping(projectPath);
  if (existing) {
    log.debug(`resolveProject: found cached mapping (folder: ${existing.folderId})`);
    // Verify folder still exists
    try {
      await client.getFolder(existing.folderId);
      log.debug("resolveProject: cached folder verified");
      return {
        folderId: existing.folderId,
        projectName: existing.projectName,
        projectPath,
        folderUrl: client.folderUrl(existing.folderId),
        created: false,
      };
    } catch (err) {
      log.warn(`resolveProject: cached folder ${existing.folderId} no longer exists, recreating`, {
        error: err instanceof Error ? err.message : String(err),
      });
      // Folder deleted remotely, fall through to find/create
    }
  } else {
    log.debug("resolveProject: no cached mapping found");
  }

  // Search existing folders by name
  const folders = await client.listFolders();
  let folder: CoChatFolderResponse | undefined;

  // First try exact name match with our metadata
  folder = folders.find(
    (f) =>
      f.name === projectName &&
      (f.meta as Record<string, unknown> | null)?.source === "mcp-cochat",
  );

  // Then try just name match
  if (!folder) {
    folder = folders.find(
      (f) => f.name.toLowerCase() === projectName.toLowerCase(),
    );
  }

  let created = false;
  if (!folder) {
    // Create new project folder
    folder = await client.createFolder(projectName, {
      source: "mcp-cochat",
      projectPath,
    });
    created = true;
  }

  // Save mapping
  setProjectMapping({
    projectPath,
    projectName,
    folderId: folder.id,
    createdAt: new Date().toISOString(),
  });

  return {
    folderId: folder.id,
    projectName,
    projectPath,
    folderUrl: client.folderUrl(folder.id),
    created,
  };
}

export async function projectsAdd(
  client: CoChatClient,
  input: ProjectsAddInput,
): Promise<string> {
  const result = await resolveCurrentProjectFolder(client, input.name);

  const verb = result.created ? "Created" : "Found existing";
  return [
    `${verb} project "${result.projectName}" in CoChat.`,
    ``,
    `Folder ID: ${result.folderId}`,
    `Folder URL: ${result.folderUrl}`,
    `Local path: ${result.projectPath}`,
  ].join("\n");
}
