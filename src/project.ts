import { execSync } from "node:child_process";
import { basename } from "node:path";

/**
 * Resolve the project name for the current working directory.
 *
 * Priority:
 * 1. Git remote origin → parse org/repo from SSH or HTTPS URL
 * 2. Basename of cwd
 * 3. "uncategorized" as last resort
 */
export function resolveProjectName(): string {
  const remote = getGitRemoteUrl();
  if (remote) {
    const parsed = parseRemoteUrl(remote);
    if (parsed) return parsed;
  }

  const cwd = process.cwd();
  if (cwd && cwd !== "/") {
    return basename(cwd);
  }

  return "uncategorized";
}

/**
 * Returns the current working directory as the project path.
 */
export function resolveProjectPath(): string {
  return process.cwd();
}

function getGitRemoteUrl(): string | null {
  try {
    const result = execSync("git remote get-url origin", {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
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
