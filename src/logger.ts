// ---------------------------------------------------------------------------
// Lightweight stderr logger for the MCP server
//
// MCP uses stdout for JSON-RPC communication, so all diagnostic logging
// goes to stderr. This is visible in client log files:
//   - Claude Code: ~/.claude/logs/
//   - OpenCode: terminal stderr
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function currentLevel(): LogLevel {
  const env = process.env.COCHAT_LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_ORDER) return env as LogLevel;
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const prefix = `[cochat-mcp ${timestamp()}] ${level.toUpperCase()}:`;
  if (data && Object.keys(data).length > 0) {
    process.stderr.write(`${prefix} ${msg} ${JSON.stringify(data)}\n`);
  } else {
    process.stderr.write(`${prefix} ${msg}\n`);
  }
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
