import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveProjectName, resolveProjectPath, setProjectRoot } from "./project.js";

// Mock child_process.execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";

const mockExecSync = vi.mocked(execSync);

describe("resolveProjectName", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset the root override between tests
    setProjectRoot(null as unknown as string);
  });

  it("parses SSH URL: git@github.com:anomalyco/cochat-open-webui.git", () => {
    mockExecSync.mockReturnValue(
      "git@github.com:anomalyco/cochat-open-webui.git\n",
    );
    expect(resolveProjectName()).toBe("anomalyco/cochat-open-webui");
  });

  it("parses HTTPS URL: https://github.com/anomalyco/cochat-open-webui.git", () => {
    mockExecSync.mockReturnValue(
      "https://github.com/anomalyco/cochat-open-webui.git\n",
    );
    expect(resolveProjectName()).toBe("anomalyco/cochat-open-webui");
  });

  it("parses HTTPS URL without .git suffix", () => {
    mockExecSync.mockReturnValue(
      "https://github.com/anomalyco/cochat-open-webui\n",
    );
    expect(resolveProjectName()).toBe("anomalyco/cochat-open-webui");
  });

  it("parses SSH URL without .git suffix", () => {
    mockExecSync.mockReturnValue("git@github.com:org/repo\n");
    expect(resolveProjectName()).toBe("org/repo");
  });

  it("falls back to parent/folder when git remote fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/home/user/my-project");
    expect(resolveProjectName()).toBe("user/my-project");
    cwdSpy.mockRestore();
  });

  it("uses parent/folder for non-git projects like playground/tictactoe", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/Volumes/Source/playground/tictactoe");
    expect(resolveProjectName()).toBe("playground/tictactoe");
    cwdSpy.mockRestore();
  });

  it("parses GitLab SSH URL with subgroup: git@gitlab.com:group/subgroup/repo.git", () => {
    mockExecSync.mockReturnValue(
      "git@gitlab.com:group/subgroup/repo.git\n",
    );
    // The regex matches the last two path segments: subgroup/repo
    expect(resolveProjectName()).toBe("subgroup/repo");
  });

  it("returns 'uncategorized' when no git and cwd is /", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/");
    expect(resolveProjectName()).toBe("uncategorized");
    cwdSpy.mockRestore();
  });
});

describe("resolveProjectPath", () => {
  beforeEach(() => {
    setProjectRoot(null as unknown as string);
  });

  it("returns the current working directory when no root override", () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/some/path");
    expect(resolveProjectPath()).toBe("/some/path");
    cwdSpy.mockRestore();
  });

  it("returns MCP root override when set", () => {
    setProjectRoot("/Volumes/Source/playground/tictactoe");
    expect(resolveProjectPath()).toBe("/Volumes/Source/playground/tictactoe");
  });
});

describe("setProjectRoot", () => {
  beforeEach(() => {
    setProjectRoot(null as unknown as string);
  });

  it("overrides process.cwd for project resolution", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });

    // Without override, uses process.cwd()
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/wrong/path");
    expect(resolveProjectPath()).toBe("/wrong/path");

    // With override, uses the root
    setProjectRoot("/Volumes/Source/playground/tictactoe");
    expect(resolveProjectPath()).toBe("/Volumes/Source/playground/tictactoe");
    expect(resolveProjectName()).toBe("playground/tictactoe");

    cwdSpy.mockRestore();
  });

  it("runs git remote from the root directory", () => {
    setProjectRoot("/my/project");
    mockExecSync.mockReturnValue("git@github.com:org/repo.git\n");
    
    resolveProjectName();
    
    expect(mockExecSync).toHaveBeenCalledWith(
      "git remote get-url origin",
      expect.objectContaining({ cwd: "/my/project" }),
    );
  });
});
