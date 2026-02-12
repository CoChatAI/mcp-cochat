import { execSync } from "node:child_process";
import { basename, dirname } from "node:path";
import { log } from "./logger.js";

// ---------------------------------------------------------------------------
// Root override – set by the server when MCP roots are available
// ---------------------------------------------------------------------------

let _rootOverride: string | null = null;

/**
 * Set the project root from MCP roots. Called by the server on initialization
 * and whenever roots change. This overrides process.cwd() for project resolution.
 * Pass null to clear the override (used in tests).
 */
export function setProjectRoot(root: string | null): void {
  _rootOverride = root;
  if (root) {
    log.info(`Project root set to: ${root}`);
  }
}

/**
 * Get the effective project directory. Prefers the MCP root override,
 * falls back to process.cwd().
 */
function effectiveCwd(): string {
  return _rootOverride ?? process.cwd();
}

/**
 * Resolve the project name for the current working directory.
 *
 * Priority:
 * 1. Git remote origin → parse org/repo from SSH or HTTPS URL
 * 2. parent/folder from the project path (e.g. "playground/tictactoe")
 * 3. Folder name alone as last resort
 * 4. "uncategorized" if nothing works
 */
export function resolveProjectName(): string {
  const cwd = effectiveCwd();

  const remote = getGitRemoteUrl(cwd);
  if (remote) {
    const parsed = parseRemoteUrl(remote);
    if (parsed) return parsed;
  }

  if (cwd && cwd !== "/") {
    const folder = basename(cwd);
    const parent = basename(dirname(cwd));
    // Use parent/folder for a more descriptive name (like org/repo)
    if (parent && parent !== "/" && parent !== ".") {
      return `${parent}/${folder}`;
    }
    return folder;
  }

  return "uncategorized";
}

/**
 * Returns the project path (MCP root or cwd).
 */
export function resolveProjectPath(): string {
  return effectiveCwd();
}

function getGitRemoteUrl(cwd?: string): string | null {
  try {
    const result = execSync("git remote get-url origin", {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
      ...(cwd ? { cwd } : {}),
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

function parseRemoteUrl(url: string): string | null {
  // SSH: git@github.com:anomalyco/cochat-open-webui.git
  const sshMatch = url.match(/[:\/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  // HTTPS: https://github.com/anomalyco/cochat-open-webui.git
  const httpsMatch = url.match(/\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return null;
}
