import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoChatConfig {
  cochatUrl: string;
  apiKey: string;
}

export interface ProjectMapping {
  projectPath: string;
  projectName: string;
  folderId: string;
  createdAt: string;
}

export interface TrackedPlan {
  chatId: string;
  planMessageId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  folderId?: string;
}

export interface CoChatStore {
  projects: Record<string, ProjectMapping>;
  plans: Record<string, TrackedPlan>;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".config", "mcp-cochat");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const STORE_FILE = join(CONFIG_DIR, "store.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// CoChatConfig – load / save / resolve
// ---------------------------------------------------------------------------

function loadPersistedConfig(): Partial<CoChatConfig> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(raw) as Partial<CoChatConfig>;
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

export function persistConfig(config: CoChatConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Resolve config from environment variables, then persisted file.
 * Returns null if config is incomplete (caller should elicit or error).
 */
export function resolveConfig(): CoChatConfig | null {
  const envUrl = process.env.COCHAT_URL;
  const envKey = process.env.COCHAT_API_KEY;

  if (envUrl && envKey) {
    return { cochatUrl: normalizeUrl(envUrl), apiKey: envKey };
  }

  const persisted = loadPersistedConfig();
  const url = envUrl ?? persisted.cochatUrl;
  const key = envKey ?? persisted.apiKey;

  if (url && key) {
    return { cochatUrl: normalizeUrl(url), apiKey: key };
  }

  return null;
}

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// ---------------------------------------------------------------------------
// Store – load / save
// ---------------------------------------------------------------------------

export function loadStore(): CoChatStore {
  try {
    if (existsSync(STORE_FILE)) {
      const raw = readFileSync(STORE_FILE, "utf-8");
      const data = JSON.parse(raw) as Partial<CoChatStore>;
      return {
        projects: data.projects ?? {},
        plans: data.plans ?? {},
      };
    }
  } catch {
    // ignore
  }
  return { projects: {}, plans: {} };
}

export function saveStore(store: CoChatStore): void {
  ensureConfigDir();
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

export function getProjectMapping(projectPath: string): ProjectMapping | undefined {
  return loadStore().projects[projectPath];
}

export function setProjectMapping(mapping: ProjectMapping): void {
  const store = loadStore();
  store.projects[mapping.projectPath] = mapping;
  saveStore(store);
}

// ---------------------------------------------------------------------------
// Plan helpers
// ---------------------------------------------------------------------------

export function trackPlan(plan: TrackedPlan): void {
  const store = loadStore();
  store.plans[plan.chatId] = plan;
  saveStore(store);
}

export function untrackPlan(chatId: string): void {
  const store = loadStore();
  delete store.plans[chatId];
  saveStore(store);
}

export function getTrackedPlan(chatId: string): TrackedPlan | undefined {
  return loadStore().plans[chatId];
}

export function getMostRecentPlan(): TrackedPlan | undefined {
  const store = loadStore();
  const entries = Object.values(store.plans);
  if (entries.length === 0) return undefined;
  return entries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
}
