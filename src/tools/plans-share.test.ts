import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CoChatClient, CoChatChatResponse } from "../cochat-client.js";
import type { ResolvedProject } from "./projects-add.js";

// Mock resolveCurrentProjectFolder
vi.mock("./projects-add.js", () => ({
  resolveCurrentProjectFolder: vi.fn(),
}));

// Mock trackPlan
vi.mock("../config.js", () => ({
  trackPlan: vi.fn(),
}));

// Mock planToMarkdown – let it run the real implementation
// Actually, we don't need to mock plan-format. Let it pass through.
// But we do need to mock crypto.randomUUID for deterministic message IDs.

import { plansShare } from "./plans-share.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";
import { trackPlan } from "../config.js";

const mockResolveProject = vi.mocked(resolveCurrentProjectFolder);
const mockTrackPlan = vi.mocked(trackPlan);

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function makeMockClient(overrides: Partial<CoChatClient> = {}): CoChatClient {
  return {
    getFolder: vi.fn(),
    listFolders: vi.fn().mockResolvedValue([]),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    folderUrl: vi.fn((id: string) => `https://cochat.example.com/f/${id}`),
    chatUrl: vi.fn((id: string) => `https://cochat.example.com/c/${id}`),
    createChat: vi.fn().mockResolvedValue({
      id: "chat-123",
      user_id: "user-1",
      title: "Plan: Test",
      chat: {},
      updated_at: Date.now() / 1000,
      created_at: Date.now() / 1000,
      archived: false,
      meta: {},
    } satisfies CoChatChatResponse),
    getChat: vi.fn(),
    updateChat: vi.fn(),
    updateMessage: vi.fn(),
    enableCollaboration: vi.fn().mockResolvedValue({}),
    setLinkAccess: vi.fn().mockResolvedValue({}),
    inviteUsers: vi.fn().mockResolvedValue({}),
    moveChatToFolder: vi.fn().mockResolvedValue({}),
    listChats: vi.fn(),
    getConfig: vi.fn(),
    getDefaultModel: vi.fn().mockResolvedValue("openrouter_manifold.anthropic/claude-sonnet-4"),
    addMemory: vi.fn(),
    queryMemories: vi.fn(),
    listMemories: vi.fn(),
    deleteMemory: vi.fn(),
    listAutomations: vi.fn(),
    triggerAutomation: vi.fn(),
    getAutomationRuns: vi.fn(),
    extractMessages: vi.fn(),
    ...overrides,
  } as unknown as CoChatClient;
}

const defaultProject: ResolvedProject = {
  folderId: "folder-abc",
  projectName: "myorg/myrepo",
  projectPath: "/home/user/myrepo",
  folderUrl: "https://cochat.example.com/f/folder-abc",
  created: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("plansShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveProject.mockResolvedValue(defaultProject);
  });

  it("creates a chat with an assistant role message", async () => {
    const client = makeMockClient();
    await plansShare(client, {
      title: "Migration Plan",
      items: [
        { id: "1", content: "Migrate DB", status: "pending", priority: "high" },
      ],
    });

    expect(client.createChat).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(client.createChat).mock.calls[0][0];
    expect(callArgs.title).toBe("Plan: Migration Plan");

    // Check that the message has assistant role
    const messages = callArgs.messages as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toContain("<!-- cochat-plan-mcp -->");
    expect(messages[0].content).toContain("Migrate DB");
  });

  it("moves chat to project folder", async () => {
    const client = makeMockClient();
    await plansShare(client, {
      title: "Test",
      items: [],
    });

    expect(client.moveChatToFolder).toHaveBeenCalledWith("chat-123", "folder-abc");
  });

  it("enables collaboration and sets link access", async () => {
    const client = makeMockClient();
    await plansShare(client, {
      title: "Test",
      items: [],
    });

    expect(client.enableCollaboration).toHaveBeenCalledWith("chat-123");
    expect(client.setLinkAccess).toHaveBeenCalledWith("chat-123", "write");
  });

  it("invites users when invite_emails provided", async () => {
    const client = makeMockClient();
    const result = await plansShare(client, {
      title: "Shared Plan",
      items: [],
      invite_emails: ["alice@example.com", "bob@example.com"],
    });

    expect(client.inviteUsers).toHaveBeenCalledWith(
      "chat-123",
      ["alice@example.com", "bob@example.com"],
      "write",
    );
    expect(result).toContain("Invited: 2 engineer(s)");
  });

  it("does not invite when no invite_emails", async () => {
    const client = makeMockClient();
    const result = await plansShare(client, {
      title: "Solo Plan",
      items: [],
    });

    expect(client.inviteUsers).not.toHaveBeenCalled();
    expect(result).not.toContain("Invited:");
  });

  it("tracks plan locally with folderId", async () => {
    const client = makeMockClient();
    await plansShare(client, {
      title: "Tracked Plan",
      items: [
        { id: "t1", content: "Task 1", status: "pending", priority: "medium" },
      ],
    });

    expect(mockTrackPlan).toHaveBeenCalledTimes(1);
    const tracked = mockTrackPlan.mock.calls[0][0];
    expect(tracked.chatId).toBe("chat-123");
    expect(tracked.title).toBe("Tracked Plan");
    expect(tracked.folderId).toBe("folder-abc");
    expect(tracked.url).toBe("https://cochat.example.com/c/chat-123");
  });

  it("response includes chat URL and project name", async () => {
    const client = makeMockClient();
    const result = await plansShare(client, {
      title: "URL Plan",
      items: [],
    });

    expect(result).toContain("https://cochat.example.com/c/chat-123");
    expect(result).toContain("myorg/myrepo");
    expect(result).toContain('Plan "URL Plan" shared successfully.');
    expect(result).toContain("Chat ID: chat-123");
  });

  it("includes description in the markdown when provided", async () => {
    const client = makeMockClient();
    await plansShare(client, {
      title: "Detailed Plan",
      description: "This plan covers the full migration strategy.",
      items: [],
    });

    const callArgs = vi.mocked(client.createChat).mock.calls[0][0];
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain("## Overview");
    expect(messages[0].content).toContain("full migration strategy");
  });
});
