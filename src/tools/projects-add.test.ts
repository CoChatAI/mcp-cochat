import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CoChatClient, CoChatFolderResponse } from "../cochat-client.js";

// Mock config module
vi.mock("../config.js", () => ({
  getProjectMapping: vi.fn(),
  setProjectMapping: vi.fn(),
}));

// Mock project module
vi.mock("../project.js", () => ({
  resolveProjectName: vi.fn(() => "myorg/myrepo"),
  resolveProjectPath: vi.fn(() => "/home/user/myrepo"),
}));

import { resolveCurrentProjectFolder } from "./projects-add.js";
import { getProjectMapping, setProjectMapping } from "../config.js";
import { resolveProjectName, resolveProjectPath } from "../project.js";

const mockGetProjectMapping = vi.mocked(getProjectMapping);
const mockSetProjectMapping = vi.mocked(setProjectMapping);
const mockResolveProjectName = vi.mocked(resolveProjectName);
const mockResolveProjectPath = vi.mocked(resolveProjectPath);

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
    createChat: vi.fn(),
    getChat: vi.fn(),
    updateChat: vi.fn(),
    updateMessage: vi.fn(),
    enableCollaboration: vi.fn(),
    setLinkAccess: vi.fn(),
    inviteUsers: vi.fn(),
    moveChatToFolder: vi.fn(),
    listChats: vi.fn(),
    getConfig: vi.fn(),
    getDefaultModel: vi.fn(),
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

function makeFolderResponse(overrides: Partial<CoChatFolderResponse> = {}): CoChatFolderResponse {
  return {
    id: "folder-default",
    name: "myorg/myrepo",
    parent_id: null,
    user_id: "user-1",
    meta: null,
    data: null,
    is_collaborative: false,
    is_expanded: false,
    access_control: null,
    link_access_level: null,
    created_at: Date.now() / 1000,
    updated_at: Date.now() / 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveCurrentProjectFolder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveProjectName.mockReturnValue("myorg/myrepo");
    mockResolveProjectPath.mockReturnValue("/home/user/myrepo");
  });

  it("returns cached mapping when folder still exists remotely", async () => {
    const existingFolder = makeFolderResponse({ id: "cached-folder-id" });

    mockGetProjectMapping.mockReturnValue({
      projectPath: "/home/user/myrepo",
      projectName: "myorg/myrepo",
      folderId: "cached-folder-id",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const client = makeMockClient({
      getFolder: vi.fn().mockResolvedValue(existingFolder),
    });

    const result = await resolveCurrentProjectFolder(client);

    expect(result.folderId).toBe("cached-folder-id");
    expect(result.projectName).toBe("myorg/myrepo");
    expect(result.created).toBe(false);
    expect(client.getFolder).toHaveBeenCalledWith("cached-folder-id");
    // Should NOT call listFolders or createFolder
    expect(client.listFolders).not.toHaveBeenCalled();
    expect(client.createFolder).not.toHaveBeenCalled();
  });

  it("falls through when cached folder was deleted remotely", async () => {
    mockGetProjectMapping.mockReturnValue({
      projectPath: "/home/user/myrepo",
      projectName: "myorg/myrepo",
      folderId: "deleted-folder-id",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const newFolder = makeFolderResponse({ id: "new-folder-id" });

    const client = makeMockClient({
      getFolder: vi.fn().mockRejectedValue(new Error("404 Not Found")),
      listFolders: vi.fn().mockResolvedValue([]),
      createFolder: vi.fn().mockResolvedValue(newFolder),
    });

    const result = await resolveCurrentProjectFolder(client);

    expect(result.folderId).toBe("new-folder-id");
    expect(result.created).toBe(true);
    expect(mockSetProjectMapping).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: "new-folder-id" }),
    );
  });

  it("reuses existing folder found by name match", async () => {
    mockGetProjectMapping.mockReturnValue(undefined);

    const existingFolder = makeFolderResponse({
      id: "name-match-id",
      name: "myorg/myrepo",
    });

    const client = makeMockClient({
      listFolders: vi.fn().mockResolvedValue([existingFolder]),
    });

    const result = await resolveCurrentProjectFolder(client);

    expect(result.folderId).toBe("name-match-id");
    expect(result.created).toBe(false);
    expect(client.createFolder).not.toHaveBeenCalled();
    expect(mockSetProjectMapping).toHaveBeenCalled();
  });

  it("reuses existing folder found by name + metadata match", async () => {
    mockGetProjectMapping.mockReturnValue(undefined);

    const metaFolder = makeFolderResponse({
      id: "meta-match-id",
      name: "myorg/myrepo",
      meta: { source: "mcp-cochat" },
    });

    const otherFolder = makeFolderResponse({
      id: "other-id",
      name: "different-project",
    });

    const client = makeMockClient({
      listFolders: vi.fn().mockResolvedValue([otherFolder, metaFolder]),
    });

    const result = await resolveCurrentProjectFolder(client);

    // Should prefer the metadata match
    expect(result.folderId).toBe("meta-match-id");
    expect(result.created).toBe(false);
  });

  it("creates new folder when no match found", async () => {
    mockGetProjectMapping.mockReturnValue(undefined);

    const createdFolder = makeFolderResponse({
      id: "brand-new-id",
      name: "myorg/myrepo",
    });

    const client = makeMockClient({
      listFolders: vi.fn().mockResolvedValue([
        makeFolderResponse({ id: "unrelated", name: "other-project" }),
      ]),
      createFolder: vi.fn().mockResolvedValue(createdFolder),
    });

    const result = await resolveCurrentProjectFolder(client);

    expect(result.folderId).toBe("brand-new-id");
    expect(result.created).toBe(true);
    expect(client.createFolder).toHaveBeenCalledWith(
      "myorg/myrepo",
      { source: "mcp-cochat", projectPath: "/home/user/myrepo" },
    );
    expect(mockSetProjectMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: "/home/user/myrepo",
        projectName: "myorg/myrepo",
        folderId: "brand-new-id",
      }),
    );
  });

  it("uses overrideName when provided", async () => {
    mockGetProjectMapping.mockReturnValue(undefined);

    const createdFolder = makeFolderResponse({
      id: "override-id",
      name: "custom-name",
    });

    const client = makeMockClient({
      listFolders: vi.fn().mockResolvedValue([]),
      createFolder: vi.fn().mockResolvedValue(createdFolder),
    });

    const result = await resolveCurrentProjectFolder(client, "custom-name");

    expect(result.projectName).toBe("custom-name");
    expect(client.createFolder).toHaveBeenCalledWith(
      "custom-name",
      expect.objectContaining({ source: "mcp-cochat" }),
    );
  });
});
