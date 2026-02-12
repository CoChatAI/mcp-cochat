import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveProjectName, resolveProjectPath } from "./project.js";

// Mock child_process.execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";

const mockExecSync = vi.mocked(execSync);

describe("resolveProjectName", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("falls back to basename of cwd when git remote fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });

    // process.cwd() returns an actual directory. We spy on it to control the value.
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/home/user/my-project");
    expect(resolveProjectName()).toBe("my-project");
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
  it("returns the current working directory", () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/some/path");
    expect(resolveProjectPath()).toBe("/some/path");
    cwdSpy.mockRestore();
  });
});
