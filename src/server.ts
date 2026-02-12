import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  RootsListChangedNotificationSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "./zod-to-json-schema.js";

import { CoChatClient, CoChatClientError } from "./cochat-client.js";
import { resolveConfig, persistConfig, type CoChatConfig } from "./config.js";
import { log } from "./logger.js";

import { setProjectRoot } from "./project.js";

// Plans
import { PlansShareSchema, plansShare } from "./tools/plans-share.js";
import { PlansPullSchema, plansPull } from "./tools/plans-pull.js";
import { PlansUpdateSchema, plansUpdate } from "./tools/plans-update.js";
import { plansList } from "./tools/plans-list.js";

// Projects
import { ProjectsAddSchema, projectsAdd } from "./tools/projects-add.js";
import { ProjectsGetSchema, projectsGet } from "./tools/projects-get.js";
import { ProjectsSetContextSchema, projectsSetContext } from "./tools/projects-set-context.js";

// Memories
import { MemoryQuerySchema, memoryQuery } from "./tools/memories-query.js";
import { MemoryAddSchema, memoryAdd } from "./tools/memories-add.js";
import { memoryList } from "./tools/memories-list.js";
import { MemoryDeleteSchema, memoryDelete } from "./tools/memories-delete.js";

// Automations
import { automationsList } from "./tools/automations-list.js";
import { AutomationsTriggerSchema, automationsTrigger } from "./tools/automations-trigger.js";
import { AutomationsRunsSchema, automationsRuns } from "./tools/automations-runs.js";

// Ask
import { CoChatAskSchema, cochatAsk } from "./tools/cochat-ask.js";

// Resources
import {
  listPlanResources,
  readPlanResource,
  subscribeToPlan,
  unsubscribeFromPlan,
  cleanupSubscriptions,
} from "./resources/plan-resource.js";

// ---------------------------------------------------------------------------
// Create and configure the MCP server
// ---------------------------------------------------------------------------

export function createServer(): Server {
  const server = new Server(
    { name: "cochat", version: "0.2.0" },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: { subscribe: true, listChanged: true },
      },
      instructions:
        "CoChat MCP bridges your coding session with your team's CoChat workspace.\n\n" +
        "IMPORTANT BEHAVIOR — Automatic Plan Sharing:\n" +
        "Whenever you create, discuss, or finalize an implementation plan, task breakdown, " +
        "or design approach with the user, you MUST automatically call the plans_share tool " +
        "to share it with the team on CoChat. Do NOT wait for the user to explicitly ask you " +
        "to share — sharing is the default behavior.\n\n" +
        "When sharing a plan:\n" +
        "- Put the FULL plan context into the 'description' field (design rationale, architecture, " +
        "data flow, technical approach, edge cases, alternatives considered). This should read like " +
        "a complete design document, NOT a summary.\n" +
        "- Put the structured task breakdown into the 'items' field.\n" +
        "- Include your model identifier in the 'model' field.\n\n" +
        "After sharing, tell the user the CoChat URL so they can see it.\n\n" +
        "Other capabilities:\n" +
        "- plans_pull: Fetch feedback from engineers on a shared plan\n" +
        "- plans_update: Push plan updates as tasks are completed\n" +
        "- memories_query/memories_add: Search and save project knowledge\n" +
        "- cochat_ask: Ask CoChat questions using the project knowledge base",
    },
  );

  let _clientSupportsElicitation = false;

  async function resolveRoots(): Promise<void> {
    try {
      const clientCaps = server.getClientCapabilities();
      if (!clientCaps?.roots) {
        log.debug("Client does not support roots");
        return;
      }

      const result = await server.listRoots();
      if (result.roots && result.roots.length > 0) {
        // Use the first root as the project directory
        const root = result.roots[0];
        const rootPath = root.uri.startsWith("file://")
          ? decodeURIComponent(root.uri.slice(7))
          : root.uri;
        log.info("Resolved project root from MCP roots", {
          uri: root.uri,
          name: root.name,
          path: rootPath,
        });
        setProjectRoot(rootPath);
      } else {
        log.debug("Client returned empty roots list");
      }
    } catch (err) {
      log.warn("Failed to resolve MCP roots, falling back to process.cwd()", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  server.oninitialized = async () => {
    const clientCaps = server.getClientCapabilities();
    _clientSupportsElicitation = !!clientCaps?.elicitation;
    log.info("MCP server initialized", {
      elicitation: _clientSupportsElicitation,
      roots: !!clientCaps?.roots,
      cwd: process.cwd(),
    });

    // Resolve project root from MCP roots (don't block initialization)
    resolveRoots();
  };

  // Listen for root changes (e.g., user switches project)
  server.setNotificationHandler(
    RootsListChangedNotificationSchema,
    async () => {
      log.info("Roots changed, re-resolving project root");
      await resolveRoots();
    },
  );

  // -----------------------------------------------------------------------
  // Config resolution
  // -----------------------------------------------------------------------

  async function getClient(): Promise<CoChatClient> {
    let config = resolveConfig();

    if (!config && _clientSupportsElicitation) {
      log.info("Config not found, attempting elicitation");
      config = await elicitConfig(server);
    }

    if (!config) {
      log.error("CoChat not configured: COCHAT_URL and/or COCHAT_API_KEY missing");
      throw new Error(
        "CoChat is not configured. Set COCHAT_URL and COCHAT_API_KEY environment variables.\n" +
          "Example:\n" +
          '  COCHAT_URL="https://your-cochat-instance.com"\n' +
          '  COCHAT_API_KEY="sk-your-api-key"\n\n' +
          "Generate an API key in CoChat: Settings > Account > API Key",
      );
    }

    log.debug("Config resolved", { url: config.cochatUrl });
    return new CoChatClient(config);
  }

  async function elicitConfig(srv: Server): Promise<CoChatConfig | null> {
    try {
      const result = await srv.request(
        {
          method: "elicitation/create",
          params: {
            message: "Configure CoChat connection. Enter your CoChat instance URL and API key.",
            requestedSchema: {
              type: "object",
              properties: {
                cochat_url: {
                  type: "string",
                  title: "CoChat URL",
                  description: "URL of your CoChat instance (e.g., https://chat.yourcompany.com)",
                  format: "uri",
                },
                api_key: {
                  type: "string",
                  title: "API Key",
                  description: "Your CoChat API key (starts with sk-). Generate in Settings > Account > API Key.",
                },
              },
              required: ["cochat_url", "api_key"],
            },
          },
        },
        {} as never,
      ) as { action: string; content?: { cochat_url?: string; api_key?: string } };

      if (result.action === "accept" && result.content?.cochat_url && result.content?.api_key) {
        const config: CoChatConfig = {
          cochatUrl: result.content.cochat_url,
          apiKey: result.content.api_key,
        };
        persistConfig(config);
        return config;
      }
    } catch {
      // Elicitation not supported or failed
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Tool definitions
  // -----------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // --- Plans ---
      {
        name: "plans_share",
        description:
          "Share an implementation plan with engineers via CoChat. Creates a collaborative " +
          "chat thread in the project folder. Call this tool AUTOMATICALLY whenever you create " +
          "or finalize a plan -- do not wait for the user to ask. IMPORTANT: The 'description' " +
          "field should contain the FULL plan document in markdown -- design rationale, " +
          "architecture, data flow, technical approach, edge cases. Engineers read this as " +
          "the primary document. Include your model identifier in the 'model' field.",
        inputSchema: zodToJsonSchema(PlansShareSchema),
      },
      {
        name: "plans_pull",
        description:
          "Pull the latest state of a shared plan from CoChat, including feedback or changes from engineers.",
        inputSchema: zodToJsonSchema(PlansPullSchema),
      },
      {
        name: "plans_update",
        description: "Push an updated plan to an existing CoChat collaborative chat thread.",
        inputSchema: zodToJsonSchema(PlansUpdateSchema),
      },
      {
        name: "plans_list",
        description: "List all shared plans grouped by project, with feedback counts.",
        inputSchema: { type: "object" as const, properties: {} },
      },

      // --- Projects ---
      {
        name: "projects_add",
        description:
          "Add a CoChat project for the current codebase. If a project with this name " +
          "already exists, returns the existing one. Auto-detects project name from git remote.",
        inputSchema: zodToJsonSchema(ProjectsAddSchema),
      },
      {
        name: "projects_get",
        description: "Get the current project's metadata, system prompt, and files.",
        inputSchema: zodToJsonSchema(ProjectsGetSchema),
      },
      {
        name: "projects_set_context",
        description:
          "Set the project system prompt. This is injected into all chats in this project on CoChat.",
        inputSchema: zodToJsonSchema(ProjectsSetContextSchema),
      },

      // --- Memories ---
      {
        name: "memories_query",
        description:
          "Semantic search project memories in CoChat. Returns relevant memories ranked by similarity.",
        inputSchema: zodToJsonSchema(MemoryQuerySchema),
      },
      {
        name: "memories_add",
        description:
          "Add a memory to the current project in CoChat. Design decisions, architectural " +
          "patterns, and important context become available in all CoChat conversations for this project.",
        inputSchema: zodToJsonSchema(MemoryAddSchema),
      },
      {
        name: "memories_list",
        description: "List recent memories for the current project.",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "memories_delete",
        description: "Delete a specific memory by ID.",
        inputSchema: zodToJsonSchema(MemoryDeleteSchema),
      },

      // --- Automations ---
      {
        name: "automations_list",
        description: "List automations for the current project, with trigger type and run status.",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "automations_trigger",
        description: "Manually trigger/run a specific automation.",
        inputSchema: zodToJsonSchema(AutomationsTriggerSchema),
      },
      {
        name: "automations_runs",
        description: "Get recent run history for an automation.",
        inputSchema: zodToJsonSchema(AutomationsRunsSchema),
      },

      // --- Ask ---
      {
        name: "cochat_ask",
        description:
          "Ask CoChat a question. Sends the question to CoChat's AI, which answers " +
          "using the project's knowledge base and memories. Useful for getting context, " +
          "checking decisions, or asking about project-specific topics.",
        inputSchema: zodToJsonSchema(CoChatAskSchema),
      },
    ],
  }));

  // -----------------------------------------------------------------------
  // Tool dispatch
  // -----------------------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log.info(`Tool called: ${name}`, { cwd: process.cwd() });

    try {
      const client = await getClient();

      let result: string;
      switch (name) {
        // Plans
        case "plans_share":
          result = await plansShare(client, PlansShareSchema.parse(args));
          break;
        case "plans_pull":
          result = await plansPull(client, PlansPullSchema.parse(args));
          break;
        case "plans_update":
          result = await plansUpdate(client, PlansUpdateSchema.parse(args));
          break;
        case "plans_list":
          result = await plansList(client);
          break;

        // Projects
        case "projects_add":
          result = await projectsAdd(client, ProjectsAddSchema.parse(args));
          break;
        case "projects_get":
          result = await projectsGet(client, ProjectsGetSchema.parse(args));
          break;
        case "projects_set_context":
          result = await projectsSetContext(client, ProjectsSetContextSchema.parse(args));
          break;

        // Memories
        case "memories_query":
          result = await memoryQuery(client, MemoryQuerySchema.parse(args));
          break;
        case "memories_add":
          result = await memoryAdd(client, MemoryAddSchema.parse(args));
          break;
        case "memories_list":
          result = await memoryList(client);
          break;
        case "memories_delete":
          result = await memoryDelete(client, MemoryDeleteSchema.parse(args));
          break;

        // Automations
        case "automations_list":
          result = await automationsList(client);
          break;
        case "automations_trigger":
          result = await automationsTrigger(client, AutomationsTriggerSchema.parse(args));
          break;
        case "automations_runs":
          result = await automationsRuns(client, AutomationsRunsSchema.parse(args));
          break;

        // Ask
        case "cochat_ask":
          result = await cochatAsk(client, CoChatAskSchema.parse(args));
          break;

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      log.info(`Tool ${name} completed successfully`);
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      const message =
        err instanceof CoChatClientError
          ? `CoChat API error (${err.statusCode}): ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);

      log.error(`Tool ${name} failed: ${message}`, {
        errorType: err instanceof CoChatClientError ? "api" : "internal",
        stack: err instanceof Error ? err.stack : undefined,
      });

      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  // -----------------------------------------------------------------------
  // Prompts
  // -----------------------------------------------------------------------

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "plans-share",
        description: "Share the current plan with the team on CoChat for review",
        arguments: [
          {
            name: "invite_emails",
            description: "Comma-separated email addresses of engineers to invite (optional)",
            required: false,
          },
        ],
      },
      {
        name: "plans-pull",
        description: "Pull the latest feedback from CoChat on a shared plan",
        arguments: [
          {
            name: "chat_id",
            description: "Chat ID of the plan to pull (optional, defaults to most recent)",
            required: false,
          },
        ],
      },
      {
        name: "memories-recall",
        description: "Recall relevant project memories for the current coding task",
        arguments: [
          {
            name: "query",
            description: "What to search for in project memories (optional, defaults to current task context)",
            required: false,
          },
        ],
      },
      {
        name: "memories-save",
        description: "Save a design decision or important context as a project memory",
        arguments: [],
      },
      {
        name: "automations-run",
        description: "List and run a project automation",
        arguments: [],
      },
      {
        name: "ask",
        description: "Ask CoChat a question about the project",
        arguments: [
          {
            name: "question",
            description: "The question to ask (optional, defaults to formulating one from context)",
            required: false,
          },
        ],
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "plans-share": {
        const emailArg = args?.invite_emails ?? "";
        const emailInstruction = emailArg ? `\n\nInvite these engineers: ${emailArg}` : "";

        return {
          description: "Share the current plan with the team on CoChat",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  "Look at the plan, task breakdown, or implementation approach we've been " +
                  "discussing in this conversation. Use the plans_share tool to share it " +
                  "with the team on CoChat.\n\n" +
                  "CRITICAL: Put the FULL plan context into the 'description' field. This " +
                  "means ALL of the following from our discussion:\n" +
                  "- Design rationale and motivation\n" +
                  "- Architecture decisions and technical approach\n" +
                  "- Data flow and component interactions\n" +
                  "- Edge cases and how they're handled\n" +
                  "- Alternatives considered and why they were rejected\n" +
                  "- Any constraints, prerequisites, or dependencies\n\n" +
                  "The description should read like a complete design document that an " +
                  "engineer can review independently -- NOT a one-line summary. Use full " +
                  "markdown formatting.\n\n" +
                  "The 'items' field should contain the structured task breakdown." +
                  emailInstruction,
              },
            },
          ],
        };
      }

      case "plans-pull": {
        const chatId = args?.chat_id ?? "";
        const chatIdInstruction = chatId ? ` Use chat_id: ${chatId}` : "";

        return {
          description: "Pull the latest feedback from CoChat",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  "Use the plans_pull tool to fetch the latest state and feedback from " +
                  "CoChat on the most recently shared plan." + chatIdInstruction + "\n\n" +
                  "Summarize:\n" +
                  "- What feedback engineers have provided\n" +
                  "- What task statuses have changed\n" +
                  "- Any actionable items, blockers, or concerns raised\n" +
                  "- Whether the plan is approved or needs further iteration",
              },
            },
          ],
        };
      }

      case "memories-recall": {
        const query = args?.query ?? "";
        const queryInstruction = query
          ? `Search for: "${query}"`
          : "Search for memories relevant to what we're currently working on in this conversation.";

        return {
          description: "Recall relevant project memories",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  `Use the memories_query tool to search project memories in CoChat. ` +
                  `${queryInstruction}\n\n` +
                  "Summarize what relevant context was found and how it applies to our current task.",
              },
            },
          ],
        };
      }

      case "memories-save": {
        return {
          description: "Save important context as a project memory",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  "Look at the important decisions, patterns, or context from our current " +
                  "conversation that should be remembered for future work on this project. " +
                  "Use the memories_add tool to save it to CoChat.\n\n" +
                  "Focus on:\n" +
                  "- Design decisions and their rationale\n" +
                  "- Architectural patterns chosen\n" +
                  "- Important constraints or gotchas discovered\n" +
                  "- Key technical context that would help future conversations",
              },
            },
          ],
        };
      }

      case "automations-run": {
        return {
          description: "List and run a project automation",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  "First use automations_list to show the available automations for this " +
                  "project. Then ask which one to run and use automations_trigger to execute it.",
              },
            },
          ],
        };
      }

      case "ask": {
        const question = args?.question ?? "";
        const questionInstruction = question
          ? `Ask CoChat: "${question}"`
          : "Formulate a relevant question based on what we're currently working on.";

        return {
          description: "Ask CoChat a question about the project",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  `Use the cochat_ask tool to ask CoChat a question. ${questionInstruction}\n\n` +
                  "CoChat will answer using the project's knowledge base and memories. " +
                  "Summarize the answer and how it relates to our current task.",
              },
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // -----------------------------------------------------------------------
  // Resources
  // -----------------------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listPlanResources(),
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: "cochat://plan/{chat_id}",
        name: "CoChat Plan",
        description: "A shared implementation plan in CoChat. Provide the chat_id to read the plan content.",
        mimeType: "text/markdown",
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    try {
      const client = await getClient();
      const resource = await readPlanResource(uri, client);
      if (!resource) throw new Error(`Unknown resource: ${uri}`);
      return { contents: [resource] };
    } catch (err) {
      throw new Error(
        `Failed to read resource ${uri}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    try {
      const client = await getClient();
      subscribeToPlan(uri, client, server);
    } catch {
      // Can't subscribe without config
    }
    return {};
  });

  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    unsubscribeFromPlan(uri);
    return {};
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  const origClose = server.close.bind(server);
  server.close = async () => {
    cleanupSubscriptions();
    return origClose();
  };

  return server;
}
