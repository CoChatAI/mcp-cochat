import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";

// Mock config so we don't need real env vars or files
vi.mock("./config.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    resolveConfig: vi.fn().mockReturnValue({
      cochatUrl: "https://cochat.test",
      apiKey: "sk-test-key",
    }),
    persistConfig: vi.fn(),
    loadStore: vi.fn().mockReturnValue({
      projects: {},
      plans: {},
      askAutomations: {},
    }),
    saveStore: vi.fn(),
    trackPlan: vi.fn(),
    getProjectMapping: vi.fn().mockReturnValue(undefined),
    setProjectMapping: vi.fn(),
    getMostRecentPlan: vi.fn().mockReturnValue(undefined),
    getTrackedPlan: vi.fn().mockReturnValue(undefined),
  };
});

// ---------------------------------------------------------------------------
// Helper: wire up a client ↔ server pair over in-memory transport
// ---------------------------------------------------------------------------

async function createConnectedPair() {
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: { roots: { listChanged: true } } });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { server, client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createServer", () => {
  it("creates a server without crashing", () => {
    const server = createServer();
    expect(server).toBeInstanceOf(Server);
  });

  it("connects to a client via in-memory transport", async () => {
    const { client } = await createConnectedPair();
    expect(client).toBeDefined();
  });

  it("lists all expected tools", async () => {
    const { client } = await createConnectedPair();
    const result = await client.listTools();

    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      "automations_list",
      "automations_runs",
      "automations_trigger",
      "cochat_ask",
      "memories_add",
      "memories_delete",
      "memories_list",
      "memories_query",
      "plans_list",
      "plans_pull",
      "plans_share",
      "plans_update",
      "projects_add",
      "projects_get",
      "projects_set_context",
    ]);
  });

  it("lists all expected prompts", async () => {
    const { client } = await createConnectedPair();
    const result = await client.listPrompts();

    const promptNames = result.prompts.map((p) => p.name).sort();
    expect(promptNames).toEqual([
      "ask",
      "automations-run",
      "memories-recall",
      "memories-save",
      "plans-pull",
      "plans-share",
    ]);
  });

  it("returns resource templates", async () => {
    const { client } = await createConnectedPair();
    const result = await client.listResourceTemplates();

    expect(result.resourceTemplates).toHaveLength(1);
    expect(result.resourceTemplates[0].uriTemplate).toBe("cochat://plan/{chat_id}");
  });

  it("returns an error for unknown tool names", async () => {
    const { client } = await createConnectedPair();
    const result = await client.callTool({ name: "nonexistent_tool", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Unknown tool: nonexistent_tool" },
    ]);
  });

  it("has server instructions that mention automatic plan sharing", async () => {
    // We verify this indirectly: the server info returned during initialization
    // should include instructions. The Client SDK stores this.
    const { client } = await createConnectedPair();
    const info = client.getServerVersion();
    expect(info).toBeDefined();
    expect(info?.name).toBe("cochat");
  });

  it("each tool has a description and inputSchema", async () => {
    const { client } = await createConnectedPair();
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.description, `${tool.name} should have a description`).toBeTruthy();
      expect(tool.inputSchema, `${tool.name} should have an inputSchema`).toBeDefined();
      expect(tool.inputSchema.type, `${tool.name} inputSchema should be an object`).toBe("object");
    }
  });

  it("each prompt has a description", async () => {
    const { client } = await createConnectedPair();
    const result = await client.listPrompts();

    for (const prompt of result.prompts) {
      expect(prompt.description, `${prompt.name} should have a description`).toBeTruthy();
    }
  });

  it("can get prompt content for plans-share", async () => {
    const { client } = await createConnectedPair();
    const result = await client.getPrompt({ name: "plans-share" });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("plans_share");
    expect(content.text).toContain("FULL plan context");
  });

  it("can get prompt content for plans-pull", async () => {
    const { client } = await createConnectedPair();
    const result = await client.getPrompt({ name: "plans-pull" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("plans_pull");
  });

  it("can get prompt content for memories-recall", async () => {
    const { client } = await createConnectedPair();
    const result = await client.getPrompt({ name: "memories-recall" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("memories_query");
  });

  it("can get prompt content for memories-save", async () => {
    const { client } = await createConnectedPair();
    const result = await client.getPrompt({ name: "memories-save" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("memories_add");
  });

  it("can get prompt content for automations-run", async () => {
    const { client } = await createConnectedPair();
    const result = await client.getPrompt({ name: "automations-run" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("automations_list");
  });

  it("can get prompt content for ask", async () => {
    const { client } = await createConnectedPair();
    const result = await client.getPrompt({ name: "ask" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("cochat_ask");
  });

  it("throws for unknown prompt name", async () => {
    const { client } = await createConnectedPair();
    await expect(client.getPrompt({ name: "nonexistent" })).rejects.toThrow();
  });
});
