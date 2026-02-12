# @cochatai/mcp-cochat

**Bridge your AI coding agent with your team.** Share plans, get feedback, and build shared project memory -- without leaving your terminal.

## The Problem

AI coding agents (Claude Code, OpenCode, Cursor, Codex) are powerful -- but they work in isolation. When your agent builds an implementation plan, that plan lives in your local session. Your team can't see it, review it, or give feedback until you manually copy it somewhere.

Meanwhile, your team is discussing architecture decisions in chat, building up project knowledge, and making decisions you can't access from your coding session.

**This MCP server connects the two worlds.**

## How It Works

```
 Your Terminal                        CoChat (Team Workspace)
 ─────────────                        ──────────────────────
                                     
 You: "Build a user dashboard"       
       │                              
       ▼                              
 Agent creates plan ──────────────▶  Plan appears as collaborative
 (auto-shared via MCP)                chat thread in project folder
                                            │
                                            ▼
                                      Team reviews, comments,
                                      suggests changes
                                            │
                                            ▼
 Agent pulls feedback ◀──────────────  "Split charts into phases"
 and adapts the plan                   "Auth endpoint looks good"
       │                              
       ▼                              
 Agent saves decisions ──────────────▶ Project memories stored
 as project memories                   (semantic search across team)
       │                              
       ▼                              
 Next session: agent recalls ◀────── Memories available in all
 past decisions automatically          CoChat conversations too
```

### The Feedback Loop

1. **You code** -- your agent creates an implementation plan
2. **Team sees it** -- the plan appears in CoChat as a collaborative thread (with full design doc, task checklist, and architecture details)
3. **Team reacts** -- engineers review, comment, mark tasks complete
4. **You pull it back** -- your agent fetches the feedback and adapts
5. **Knowledge compounds** -- design decisions get saved as project memories, available to everyone

This loop means your team stays in sync without standups, Slack threads, or PRs-as-documentation. The agent does the sharing for you.

### What You Get

- **Plans** -- Implementation plans shared as collaborative chats. Engineers review and comment. Pull feedback back into your coding session.
- **Project Memories** -- Semantic memory that persists across sessions. "Why did we pick PostgreSQL?" is answerable by anyone, in any tool.
- **Ask** -- Query your project's knowledge base from your terminal. Get answers grounded in your team's actual decisions.
- **Automations** -- Trigger CoChat automations (scheduled tasks, workflows) without switching context.
- **Auto-scoping** -- Everything is automatically organized by project (detected from git remote or directory name). No manual setup.

## Quick Start

### 1. Get a CoChat API Key

Sign up at [app.cochat.ai](https://app.cochat.ai) (or use your self-hosted instance), then go to **Settings > Account > API Key**.

### 2. Add to Your Coding Agent

<details>
<summary><strong>Claude Code</strong></summary>

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

Prompts become slash commands: `/mcp__cochat__plans-share`, `/mcp__cochat__memories-recall`, `/mcp__cochat__ask`, etc.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

Add to your `opencode.json` (project root or `~/.config/opencode/config.json` for global):

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

Slash commands: `/cochat:plans-share:mcp`, `/cochat:plans-pull:mcp`, `/cochat:memories-recall:mcp`, `/cochat:ask:mcp`, etc.

</details>

<details>
<summary><strong>Cursor</strong></summary>

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

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

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

</details>

<details>
<summary><strong>Kilo Code</strong></summary>

Add the MCP server via Kilo Code's settings. Use the standard MCP config format:

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

</details>

### 3. Start Using It

Plans are shared automatically when your agent creates them. You can also use slash commands:

```
> Plan a user authentication system with JWT

Agent creates plan and auto-shares to CoChat...

  Plan "JWT Authentication System" shared successfully.
  Chat URL: https://app.cochat.ai/c/abc123
  Project: your-org/your-repo
  Collaboration is enabled with write access via link.

> Pull feedback on the plan

Agent fetches from CoChat...

  Alice suggested using refresh token rotation.
  Bob marked "Create login endpoint" as completed.
  2 new feedback messages since you shared.

> Save the decision about refresh token rotation as a memory

  Memory added. Available in all CoChat conversations for this project.
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COCHAT_URL` | Yes | URL of your CoChat instance (e.g., `https://app.cochat.ai`) |
| `COCHAT_API_KEY` | Yes | Your CoChat API key. Generate one in CoChat: Settings > Account > API Key |
| `COCHAT_LOG_LEVEL` | No | Log verbosity: `debug`, `info` (default), `warn`, `error` |

### Elicitation (Interactive Setup)

If environment variables are not set and your MCP client supports [elicitation](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation), the server will prompt you for your CoChat URL and API key on first use. The config is persisted to `~/.config/mcp-cochat/config.json`.

### Local State

The server stores project mappings and tracked plans in `~/.config/mcp-cochat/store.json`. This maps your local project directories to CoChat folders so plans and memories are scoped correctly.

### Project Detection

The server identifies your project automatically:

1. **Git remote** -- parses `git remote get-url origin` (e.g., `anomalyco/my-project`)
2. **MCP roots** -- uses the client-reported project directory if available
3. **Directory name** -- falls back to `parent/folder` (e.g., `playground/tictactoe`)

No manual project setup needed. The CoChat folder is created lazily on first use.

## Tools

### Plans

| Tool | Description |
|------|-------------|
| `plans_share` | Share an implementation plan as a collaborative chat in CoChat. Auto-called when the agent creates a plan. |
| `plans_pull` | Fetch the latest plan state and engineer feedback from CoChat. |
| `plans_update` | Push an updated plan to an existing CoChat chat thread. |
| `plans_list` | List all shared plans grouped by project, with feedback counts. |

### Projects

| Tool | Description |
|------|-------------|
| `projects_add` | Add a CoChat project for the current codebase. Auto-detects name from git remote. |
| `projects_get` | Get the current project's metadata, system prompt, and file count. |
| `projects_set_context` | Set the project system prompt, injected into all CoChat chats for this project. |

### Memories

| Tool | Description |
|------|-------------|
| `memories_query` | Semantic search project memories, ranked by relevance. |
| `memories_add` | Store a design decision or important context as a project memory. |
| `memories_list` | List all recent memories for the current project. |
| `memories_delete` | Delete a specific memory by ID. |

### Automations

| Tool | Description |
|------|-------------|
| `automations_list` | List automations for the current project. |
| `automations_trigger` | Manually trigger an automation by ID. |
| `automations_runs` | Get recent run history for an automation. |

### Ask

| Tool | Description |
|------|-------------|
| `cochat_ask` | Ask CoChat a question. Gets an AI answer using the project's knowledge base and memories. |

## Prompts (Slash Commands)

| Prompt | Description |
|--------|-------------|
| `plans-share` | Share the current plan with the team. Instructs the AI to include the full design context. |
| `plans-pull` | Pull and summarize feedback from the most recent shared plan. |
| `memories-recall` | Search project memories for context relevant to the current task. |
| `memories-save` | Save important decisions from the conversation as project memories. |
| `automations-run` | List and run a project automation. |
| `ask` | Ask CoChat a question about the project. |

How these appear depends on your client:

| Client | Format | Example |
|--------|--------|---------|
| OpenCode | `/server:prompt:mcp` | `/cochat:plans-share:mcp` |
| Claude Code | `/mcp__server__prompt` | `/mcp__cochat__plans-share` |
| Cursor | Varies | Available in agent mode |
| Codex CLI | Tool-based | Accessible via tools |
| Kilo Code | Varies | Accessible via MCP |

## Resources

| URI Pattern | Description |
|-------------|-------------|
| `cochat://plan/{chat_id}` | Current state of a shared plan. Clients with MCP resource subscriptions get change notifications (polled every 10s). |

## Development

### Building from Source

```bash
git clone https://github.com/CoChatAI/mcp-cochat.git
cd mcp-cochat
npm install
npm run build
npm test
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

### Debugging

The server logs to stderr (MCP uses stdout for JSON-RPC). Set `COCHAT_LOG_LEVEL=debug` for verbose output including all API requests.

In Claude Code, stderr logs appear in `~/.claude/logs/`. In OpenCode, they appear in the terminal.

### Project Structure

```
src/
├── index.ts                    # Entry point (stdio transport)
├── server.ts                   # MCP server (tool/prompt/resource registration)
├── cochat-client.ts            # HTTP client for CoChat REST API
├── config.ts                   # Configuration and local state management
├── project.ts                  # Git remote detection, project name resolution
├── logger.ts                   # Stderr logger (debug/info/warn/error)
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
│   ├── memories-query.ts       # Semantic search memories
│   ├── memories-add.ts         # Add project memory
│   ├── memories-list.ts        # List project memories
│   ├── memories-delete.ts      # Delete memory
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
| Tools (16) | Yes | Yes | Yes | Yes | Yes |
| Prompts (6) | Yes | Yes | Varies | Varies | Varies |
| Resources | Yes | Yes | Varies | Varies | Varies |
| Resource Subscriptions | Yes | Likely | Unlikely | Unlikely | Unlikely |
| Elicitation | Varies | Varies | Unlikely | Unlikely | Unlikely |

All 16 tools work across every MCP-compatible client. Prompts and resources depend on the client's MCP spec support.

## License

MIT
