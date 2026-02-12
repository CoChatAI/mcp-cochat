import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the filesystem. We store an in-memory map of file path -> contents.
// ---------------------------------------------------------------------------

const fakeFs: Map<string, string> = new Map();

vi.mock("node:fs", () => ({
  existsSync: vi.fn((p: string) => fakeFs.has(p)),
  readFileSync: vi.fn((p: string) => {
    if (!fakeFs.has(p)) throw new Error("ENOENT");
    return fakeFs.get(p)!;
  }),
  writeFileSync: vi.fn((p: string, data: string) => {
    fakeFs.set(p, data);
  }),
  mkdirSync: vi.fn(),
}));

import {
  resolveConfig,
  resolveAutoShareMode,
  persistConfig,
  loadStore,
  saveStore,
  trackPlan,
  getTrackedPlan,
  getMostRecentPlan,
  setProjectMapping,
  getProjectMapping,
  type CoChatStore,
  type TrackedPlan,
} from "./config.js";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const savedEnv: Record<string, string | undefined> = {};

const ENV_KEYS = ["COCHAT_URL", "COCHAT_API_KEY", "COCHAT_AUTO_SHARE"] as const;

beforeEach(() => {
  fakeFs.clear();
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

// ---------------------------------------------------------------------------
// resolveConfig
// ---------------------------------------------------------------------------

describe("resolveConfig", () => {
  it("returns null when no env vars and no file", () => {
    expect(resolveConfig()).toBeNull();
  });

  it("returns config from env vars", () => {
    process.env.COCHAT_URL = "https://cochat.example.com/";
    process.env.COCHAT_API_KEY = "sk-test-key";

    const config = resolveConfig();
    expect(config).not.toBeNull();
    expect(config!.cochatUrl).toBe("https://cochat.example.com"); // trailing slash stripped
    expect(config!.apiKey).toBe("sk-test-key");
  });

  it("returns config from persisted file when env is partial", () => {
    // Simulate a saved config file
    const configDir = `${process.env.HOME}/.config/mcp-cochat`;
    const configPath = `${configDir}/config.json`;
    fakeFs.set(
      configPath,
      JSON.stringify({ cochatUrl: "https://saved.example.com", apiKey: "saved-key" }),
    );

    // With no env vars, resolveConfig should fall back to persisted file
    const config = resolveConfig();
    expect(config).not.toBeNull();
    expect(config!.cochatUrl).toBe("https://saved.example.com");
    expect(config!.apiKey).toBe("saved-key");
  });
});

// ---------------------------------------------------------------------------
// loadStore / saveStore
// ---------------------------------------------------------------------------

describe("loadStore / saveStore", () => {
  it("returns empty store when file does not exist", () => {
    const store = loadStore();
    expect(store.projects).toEqual({});
    expect(store.plans).toEqual({});
  });

  it("round-trips a store", () => {
    const store: CoChatStore = {
      projects: {
        "/path/to/project": {
          projectPath: "/path/to/project",
          projectName: "org/repo",
          folderId: "folder-123",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
      askAutomations: {},
      plans: {
        "chat-abc": {
          chatId: "chat-abc",
          planMessageId: "msg-1",
          title: "Test Plan",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          url: "https://cochat.example.com/c/chat-abc",
        },
      },
    };

    saveStore(store);
    const loaded = loadStore();
    expect(loaded).toEqual(store);
  });

  it("defaults missing 'projects' field to empty object (backward compat)", () => {
    // Simulate an older store that only has plans
    const configDir = `${process.env.HOME}/.config/mcp-cochat`;
    const storePath = `${configDir}/store.json`;
    fakeFs.set(storePath, JSON.stringify({ plans: { "c1": { chatId: "c1" } } }));

    const store = loadStore();
    expect(store.projects).toEqual({});
    expect(store.plans).toHaveProperty("c1");
  });
});

// ---------------------------------------------------------------------------
// trackPlan / getTrackedPlan / getMostRecentPlan
// ---------------------------------------------------------------------------

describe("plan tracking", () => {
  it("trackPlan and getTrackedPlan round-trip", () => {
    const plan: TrackedPlan = {
      chatId: "chat-1",
      planMessageId: "msg-1",
      title: "My Plan",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      url: "https://cochat.example.com/c/chat-1",
    };

    trackPlan(plan);
    const retrieved = getTrackedPlan("chat-1");
    expect(retrieved).toEqual(plan);
  });

  it("getTrackedPlan returns undefined for unknown chatId", () => {
    expect(getTrackedPlan("nonexistent")).toBeUndefined();
  });

  it("getMostRecentPlan returns the most recently updated plan", () => {
    trackPlan({
      chatId: "chat-old",
      planMessageId: "msg-old",
      title: "Old Plan",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      url: "https://cochat.example.com/c/chat-old",
    });

    trackPlan({
      chatId: "chat-new",
      planMessageId: "msg-new",
      title: "New Plan",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      url: "https://cochat.example.com/c/chat-new",
    });

    const most = getMostRecentPlan();
    expect(most).toBeDefined();
    expect(most!.chatId).toBe("chat-new");
  });

  it("getMostRecentPlan returns undefined when no plans tracked", () => {
    expect(getMostRecentPlan()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setProjectMapping / getProjectMapping
// ---------------------------------------------------------------------------

describe("project mapping", () => {
  it("round-trips a project mapping", () => {
    setProjectMapping({
      projectPath: "/home/user/myapp",
      projectName: "myorg/myapp",
      folderId: "folder-xyz",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const mapping = getProjectMapping("/home/user/myapp");
    expect(mapping).toBeDefined();
    expect(mapping!.projectName).toBe("myorg/myapp");
    expect(mapping!.folderId).toBe("folder-xyz");
  });

  it("returns undefined for unmapped path", () => {
    expect(getProjectMapping("/does/not/exist")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveAutoShareMode
// ---------------------------------------------------------------------------

describe("resolveAutoShareMode", () => {
  it("defaults to 'off' when env var is not set", () => {
    expect(resolveAutoShareMode()).toBe("off");
  });

  it("returns 'plan' when COCHAT_AUTO_SHARE=plan", () => {
    process.env.COCHAT_AUTO_SHARE = "plan";
    expect(resolveAutoShareMode()).toBe("plan");
  });

  it("returns 'all' when COCHAT_AUTO_SHARE=all", () => {
    process.env.COCHAT_AUTO_SHARE = "all";
    expect(resolveAutoShareMode()).toBe("all");
  });

  it("is case-insensitive", () => {
    process.env.COCHAT_AUTO_SHARE = "PLAN";
    expect(resolveAutoShareMode()).toBe("plan");

    process.env.COCHAT_AUTO_SHARE = "All";
    expect(resolveAutoShareMode()).toBe("all");
  });

  it("trims whitespace", () => {
    process.env.COCHAT_AUTO_SHARE = "  plan  ";
    expect(resolveAutoShareMode()).toBe("plan");
  });

  it("defaults to 'off' for unrecognized values", () => {
    process.env.COCHAT_AUTO_SHARE = "yes";
    expect(resolveAutoShareMode()).toBe("off");

    process.env.COCHAT_AUTO_SHARE = "true";
    expect(resolveAutoShareMode()).toBe("off");

    process.env.COCHAT_AUTO_SHARE = "auto";
    expect(resolveAutoShareMode()).toBe("off");
  });

  it("returns 'off' for empty string", () => {
    process.env.COCHAT_AUTO_SHARE = "";
    expect(resolveAutoShareMode()).toBe("off");
  });
});
