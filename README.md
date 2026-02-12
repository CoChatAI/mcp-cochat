# @cochatai/mcp-cochat

MCP server that connects your coding agent to [CoChat](https://cochat.ai) -- share implementation plans, query project memories, and trigger automations, all from within your editor.

Works with **OpenCode**, **Claude Code**, **Cursor**, **Codex CLI**, and **Kilo Code**.

## What It Does

When you're working in a coding agent and want to collaborate with your team, this MCP server bridges the gap:

- **Plans** -- Share implementation plans as collaborative chat threads in CoChat. Engineers review, comment, and suggest changes. Pull feedback back into your coding session.
- **Projects** -- Automatically creates a CoChat project (folder) for each codebase, scoped by git remote. Plans, memories, and automations are organized per-project.
- **Memories** -- Query and store project knowledge in CoChat's semantic memory system. Design decisions, architectural patterns, and important context become available across all CoChat conversations for the project.
- **Automations** -- List and trigger CoChat automations from your coding agent. Run scheduled tasks, webhook triggers, or manual workflows.
- **Ask** -- Ask CoChat a question and get an AI-powered answer using the project's knowledge base and memories.

## Prerequisites

- **Node.js** >= 18.0.0
- A **CoChat** instance (self-hosted or [app.cochat.ai](https://app.cochat.ai))
- A **CoChat API key** (generate one in CoChat: Settings > Account > API Key)

## Installation

### OpenCode

Add to your `opencode.json` (in the project root or `~/.config/opencode/config.json` for global):

```jsonc
{
  "mcp": {
    "cochat": {
      "type": "local",
      "command": ["npx", "@cochatai/mcp-cochat"],
      "environment": {
        "COCHAT_URL": "https://app.cochat.ai",
        "COCHAT_API_KEY": "your-api-key"
      }
    }
  }
}
```

Restart OpenCode to load the MCP. You'll see new slash commands: `/cochat:plans-share:mcp`, `/cochat:plans-pull:mcp`, `/cochat:memories-recall:mcp`, `/cochat:ask:mcp`, etc.

### Claude Code

```bash
claude mcp add cochat \
  -e COCHAT_URL="https://app.cochat.ai" \
  -e COCHAT_API_KEY="your-api-key" \
  -- npx @cochatai/mcp-cochat
```

Or via JSON:

```bash
claude mcp add-json cochat '{
  "type": "stdio",
  "command": "npx",
  "args": ["@cochatai/mcp-cochat"],
  "env": {
    "COCHAT_URL": "https://app.cochat.ai",
    "COCHAT_API_KEY": "your-api-key"
  }
}'
```

MCP prompts become slash commands: `/mcp__cochat__plans-share`, `/mcp__cochat__memories-recall`, `/mcp__cochat__ask`, etc.

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "cochat": {
      "command": "npx",
      "args": ["@cochatai/mcp-cochat"],
      "env": {
        "COCHAT_URL": "https://app.cochat.ai",
        "COCHAT_API_KEY": "your-api-key"
      }
    }
  }
}
```

Tools are available in Agent mode. Use `@cochat` to reference the MCP in chat.

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.cochat]
command = "npx"
args = ["@cochatai/mcp-cochat"]

[mcp_servers.cochat.env]
COCHAT_URL = "https://app.cochat.ai"
COCHAT_API_KEY = "your-api-key"
```

Or via CLI:

```bash
codex mcp add cochat \
  -e COCHAT_URL="https://app.cochat.ai" \
  -e COCHAT_API_KEY="your-api-key" \
  -- npx @cochatai/mcp-cochat
```

### Kilo Code

Add the MCP server via Kilo Code's settings or CLI configuration. Use the standard MCP config format:

```json
{
  "cochat": {
    "command": "npx",
    "args": ["@cochatai/mcp-cochat"],
    "env": {
      "COCHAT_URL": "https://app.cochat.ai",
      "COCHAT_API_KEY": "your-api-key"
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COCHAT_URL` | Yes | URL of your CoChat instance (e.g., `https://app.cochat.ai`) |
| `COCHAT_API_KEY` | Yes | Your CoChat API key. Generate one in CoChat: Settings > Account > API Key |

### Elicitation (Interactive Setup)

If environment variables are not set and your MCP client supports [elicitation](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation), the server will prompt you for your CoChat URL and API key on first use. The config is persisted to `~/.config/mcp-cochat/config.json`.

### Local State

The server stores project mappings and tracked plans in `~/.config/mcp-cochat/store.json`. This maps your local project directories to CoChat folders so plans and memories are scoped correctly.

## Tools

### Plans

| Tool | Description |
|------|-------------|
| `plans_share` | Share an implementation plan as a collaborative chat in CoChat. Creates the plan as an assistant message with full markdown (including task list checkboxes). The chat is placed in the project folder with collaboration enabled. |
| `plans_pull` | Fetch the latest plan state and engineer feedback from CoChat. Returns the current task list and all reply messages from collaborators. |
| `plans_update` | Push an updated plan to an existing CoChat chat thread. Atomically replaces the plan message content. |
| `plans_list` | List all shared plans grouped by project, with feedback message counts. |

#### Example: Sharing a Plan

Ask your coding agent to share a plan:

```
> Share the implementation plan with the team

The agent calls plans_share with:
- title: "Add User Dashboard"
- description: Full design document (architecture, data flow, edge cases...)
- items: Structured task list with priorities and statuses

Result:
  Plan "Add User Dashboard" shared successfully.
  Chat URL: https://app.cochat.ai/c/abc123
  Project: anomalyco/my-project
  Collaboration is enabled with write access via link.
```

Engineers open the URL in CoChat, review the plan, and add comments. Later:

```
> Pull the latest feedback on my plan

The agent calls plans_pull and summarizes:
  Alice suggested splitting the chart component into phases.
  Bob marked "Create API endpoints" as completed.
  2 new feedback messages since you shared.
```

### Projects

| Tool | Description |
|------|-------------|
| `projects_add` | Add a CoChat project for the current codebase. Auto-detects the project name from `git remote get-url origin` (e.g., `anomalyco/my-project`). If a project with this name already exists in CoChat, it reuses it. |
| `projects_get` | Get the current project's metadata, system prompt, and file count. |
| `projects_set_context` | Set the project system prompt. This is injected into all chats created in this project on CoChat, giving the AI context about the codebase. |

Project folders are created lazily -- the first time you share a plan or add a memory, the project folder is automatically created in CoChat.

### Memories

| Tool | Description |
|------|-------------|
| `memories_query` | Semantic search project memories. Returns the most relevant memories ranked by similarity to your query. |
| `memories_add` | Store a memory in the current project. Design decisions, architectural patterns, and important context become available in all CoChat conversations for this project. |
| `memories_list` | List all recent memories for the current project. |
| `memories_delete` | Delete a specific memory by ID. |

#### Example: Saving and Recalling Context

```
> Save the decision about using PostgreSQL with pgvector for embeddings

The agent calls memories_add:
  Memory added successfully.
  This memory is now available in all CoChat conversations for this project.
```

Later, in a different session or by a different team member in CoChat:

```
> What embedding storage solution are we using?

The agent calls memories_query:
  Found: "We decided to use PostgreSQL with pgvector for embedding storage
  because it avoids an additional infrastructure dependency and supports
  HNSW indexing for fast approximate nearest neighbor search."
```

### Automations

| Tool | Description |
|------|-------------|
| `automations_list` | List automations for the current project. Shows trigger type, enabled status, last run, and next scheduled run. |
| `automations_trigger` | Manually trigger a specific automation by ID. Returns the run ID and status. |
| `automations_runs` | Get recent run history for an automation, including status, timing, and any errors. |

### Ask

| Tool | Description |
|------|-------------|
| `cochat_ask` | Ask CoChat a question. Sends the question to CoChat's AI, which answers using the project's knowledge base and memories. On first use, automatically creates an "MCP Ask" automation in the project. |

#### Example: Asking CoChat

```
> Ask CoChat what auth pattern we decided on

The agent calls cochat_ask with:
- question: "What authentication pattern was decided for this project?"

Result:
  Based on the project memories, you decided to use JWT with refresh
  tokens stored in httpOnly cookies. The access token expires after
  15 minutes and the refresh token after 7 days.
```

## Prompts (Slash Commands)

The MCP server exposes prompts that your client may surface as slash commands:

| Prompt | Description |
|--------|-------------|
| `plans-share` | Instructs the AI to share the current plan with the team on CoChat. Includes detailed instructions to put the full design context (not just a summary) into the plan description. |
| `plans-pull` | Instructs the AI to pull and summarize feedback from the most recent shared plan. |
| `memories-recall` | Instructs the AI to search project memories for context relevant to the current task. |
| `memories-save` | Instructs the AI to identify important decisions from the conversation and save them as project memories. |
| `automations-run` | Instructs the AI to list available automations and ask which one to run. |
| `ask` | Instructs the AI to ask CoChat a question about the project, using the project's knowledge and memories. |

How these appear depends on your client:

| Client | Format | Example |
|--------|--------|---------|
| OpenCode | `/server:prompt:mcp` | `/cochat:plans-share:mcp` |
| Claude Code | `/mcp__server__prompt` | `/mcp__cochat__plans-share` |
| Cursor | Varies | Available in agent mode |
| Codex CLI | Tool-based | Accessible via tools |
| Kilo Code | Varies | Accessible via MCP |

## Resources

The server exposes subscribable resources for tracked plans:

| URI Pattern | Description |
|-------------|-------------|
| `cochat://plan/{chat_id}` | The current state of a shared plan. Clients that support MCP resource subscriptions get notified when the plan changes in CoChat (polled every 10 seconds). |

## How It Works

### Project Scoping

When any tool is called that needs a project context (plans, memories, automations), the server:

1. Detects the project name from `git remote get-url origin` (e.g., `anomalyco/my-project`)
2. Checks the local cache (`~/.config/mcp-cochat/store.json`) for an existing mapping
3. If not cached, searches CoChat folders for a matching name
4. If not found, creates a new CoChat folder with metadata linking it to the local path
5. Caches the mapping for future use

This means plans, memories, and automations are automatically scoped to the right project without any manual configuration.

### Plan Format

Plans are stored as assistant messages in CoChat collaborative chats. The message content is structured markdown:

```markdown
<!-- cochat-plan-mcp -->
# Plan: Your Plan Title

> Shared from coding-agent | Updated: 2026-02-12T10:30:00Z

## Overview

Full design document with rationale, architecture,
data flow, edge cases, etc.

## Tasks

- [ ] **[HIGH]** First task
- [x] **[HIGH]** Completed task
- [ ] **[MED]** Medium priority task
  - [ ] **[MED]** Sub-task
- [ ] **[LOW]** Low priority task *(in progress)*

---
*Reply below with feedback. The plan author can pull your comments back into their local session.*
```

The `<!-- cochat-plan-mcp -->` marker allows the server to identify plan messages when pulling updates.

## Development

### Building from Source

```bash
git clone https://github.com/CoChatAI/mcp-cochat.git
cd mcp-cochat
npm install
npm run build
```

### Running Tests

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

### Using a Local Build

Point your MCP client to the local build instead of npx:

**OpenCode:**
```jsonc
{
  "mcp": {
    "cochat": {
      "type": "local",
      "command": ["node", "/path/to/mcp-cochat/dist/index.js"],
      "environment": {
        "COCHAT_URL": "https://app.cochat.ai",
        "COCHAT_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Claude Code:**
```bash
claude mcp add cochat \
  -e COCHAT_URL="https://app.cochat.ai" \
  -e COCHAT_API_KEY="your-api-key" \
  -- node /path/to/mcp-cochat/dist/index.js
```

### Project Structure

```
src/
├── index.ts                    # Entry point (stdio transport)
├── server.ts                   # MCP server (tool/prompt/resource registration)
├── cochat-client.ts            # HTTP client for CoChat REST API
├── config.ts                   # Configuration and local state management
├── project.ts                  # Git remote detection, project name resolution
├── plan-format.ts              # Plan <-> markdown serialization
├── schemas.ts                  # Shared Zod schemas
├── zod-to-json-schema.ts       # Lightweight Zod to JSON Schema converter
├── tools/
│   ├── plans-share.ts          # Share plan as collaborative chat
│   ├── plans-pull.ts           # Fetch plan state + feedback
│   ├── plans-update.ts         # Push updated plan
│   ├── plans-list.ts           # List tracked plans by project
│   ├── projects-add.ts         # Find/create project folder
│   ├── projects-get.ts         # Get project metadata
│   ├── projects-set-context.ts # Set project system prompt
│   ├── memories-query.ts        # Semantic search memories
│   ├── memories-add.ts          # Add project memory
│   ├── memories-list.ts         # List project memories
│   ├── memories-delete.ts       # Delete memory
│   ├── automations-list.ts     # List project automations
│   ├── automations-trigger.ts  # Trigger automation
│   ├── automations-runs.ts     # Get automation run history
│   └── cochat-ask.ts           # Ask CoChat a question
└── resources/
    └── plan-resource.ts        # Subscribable plan resources
```

## Compatibility

| Feature | OpenCode | Claude Code | Codex CLI | Cursor | Kilo Code |
|---------|----------|-------------|-----------|--------|-----------|
| Tools (15) | Yes | Yes | Yes | Yes | Yes |
| Prompts (6) | Yes | Yes | Varies | Varies | Varies |
| Resources | Yes | Yes | Varies | Varies | Varies |
| Resource Subscriptions | Yes | Likely | Unlikely | Unlikely | Unlikely |
| Elicitation | Varies | Varies | Unlikely | Unlikely | Unlikely |

All 15 tools work across every MCP-compatible client. Prompts and resources depend on the client's MCP spec support. Resource subscriptions (automatic change notifications) are a newer MCP feature -- clients that don't support them can use `plans_pull` as a manual alternative.

## License

MIT
