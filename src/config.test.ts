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

beforeEach(() => {
  fakeFs.clear();
  savedEnv.COCHAT_URL = process.env.COCHAT_URL;
  savedEnv.COCHAT_API_KEY = process.env.COCHAT_API_KEY;
  delete process.env.COCHAT_URL;
  delete process.env.COCHAT_API_KEY;
});

afterEach(() => {
  if (savedEnv.COCHAT_URL !== undefined) {
    process.env.COCHAT_URL = savedEnv.COCHAT_URL;
  } else {
    delete process.env.COCHAT_URL;
  }
  if (savedEnv.COCHAT_API_KEY !== undefined) {
    process.env.COCHAT_API_KEY = savedEnv.COCHAT_API_KEY;
  } else {
    delete process.env.COCHAT_API_KEY;
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
