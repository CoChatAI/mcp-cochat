#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./logger.js";
import { createServer } from "./server.js";

async function main() {
  log.info("Starting cochat MCP server", { cwd: process.cwd(), pid: process.pid });

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  log.info("MCP server connected via stdio");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
