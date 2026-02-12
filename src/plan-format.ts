// ---------------------------------------------------------------------------
// Plan data types
// ---------------------------------------------------------------------------

export type PlanItemStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type PlanItemPriority = "high" | "medium" | "low";

export interface PlanItem {
  id: string;
  content: string;
  status: PlanItemStatus;
  priority: PlanItemPriority;
  children?: PlanItem[];
}

export interface PlanMetadata {
  source: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  title: string;
  description?: string;
  items: PlanItem[];
  metadata: PlanMetadata;
}

// ---------------------------------------------------------------------------
// Metadata marker – embedded in the markdown so we can identify plan messages
// ---------------------------------------------------------------------------

const PLAN_MARKER = "<!-- cochat-plan-mcp -->";

// ---------------------------------------------------------------------------
// Serialize: Plan -> Markdown
// ---------------------------------------------------------------------------

function priorityLabel(p: PlanItemPriority): string {
  switch (p) {
    case "high":
      return "**[HIGH]**";
    case "medium":
      return "**[MED]**";
    case "low":
      return "**[LOW]**";
  }
}

function statusCheckbox(s: PlanItemStatus): string {
  return s === "completed" ? "[x]" : "[ ]";
}

function formatItem(item: PlanItem, indent: number): string {
  const prefix = "  ".repeat(indent) + "- ";
  const checkbox = statusCheckbox(item.status);
  const priority = priorityLabel(item.priority);
  let line = `${prefix}${checkbox} ${priority} ${item.content}`;

  if (item.status === "in_progress") {
    line += " *(in progress)*";
  } else if (item.status === "cancelled") {
    line += " ~~cancelled~~";
  }

  const childLines = (item.children ?? [])
    .map((child) => formatItem(child, indent + 1))
    .join("\n");

  return childLines ? `${line}\n${childLines}` : line;
}

export function planToMarkdown(plan: Plan): string {
  const lines: string[] = [];

  lines.push(PLAN_MARKER);
  lines.push(`# Plan: ${plan.title}`);
  lines.push("");
  lines.push(
    `> Shared from ${plan.metadata.source} | Updated: ${plan.metadata.updatedAt}`
  );
  lines.push("");

  if (plan.description) {
    lines.push("## Overview");
    lines.push("");
    lines.push(plan.description);
    lines.push("");
  }

  lines.push("## Tasks");
  lines.push("");

  for (const item of plan.items) {
    lines.push(formatItem(item, 0));
  }

  lines.push("");
  lines.push("---");
  lines.push(
    "*Reply below with feedback. The plan author can pull your comments back into their local session.*"
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Deserialize: Markdown -> Plan
// ---------------------------------------------------------------------------

const ITEM_RE =
  /^(\s*)- \[([ xX])\]\s+\*\*\[(HIGH|MED|LOW)\]\*\*\s+(.+?)(?:\s+\*\(in progress\)\*)?(?:\s+~~cancelled~~)?$/;

function parsePriority(raw: string): PlanItemPriority {
  switch (raw) {
    case "HIGH":
      return "high";
    case "MED":
      return "medium";
    case "LOW":
      return "low";
    default:
      return "medium";
  }
}

function parseStatus(checkbox: string, rest: string): PlanItemStatus {
  if (rest.includes("~~cancelled~~")) return "cancelled";
  if (rest.includes("*(in progress)*")) return "in_progress";
  return checkbox.trim().toLowerCase() === "x" ? "completed" : "pending";
}

interface ParsedLine {
  indent: number;
  item: PlanItem;
}

export function markdownToPlan(md: string): Plan | null {
  if (!md.includes(PLAN_MARKER)) return null;

  const lines = md.split("\n");

  // Extract title
  const titleLine = lines.find((l) => l.startsWith("# Plan: "));
  const title = titleLine ? titleLine.replace("# Plan: ", "").trim() : "Untitled Plan";

  // Extract metadata from blockquote
  const metaLine = lines.find((l) => l.startsWith("> Shared from "));
  let source = "unknown";
  let updatedAt = new Date().toISOString();
  if (metaLine) {
    const sourceMatch = metaLine.match(/Shared from ([^|]+)/);
    if (sourceMatch) source = sourceMatch[1].trim();
    const dateMatch = metaLine.match(/Updated: (.+)/);
    if (dateMatch) updatedAt = dateMatch[1].trim();
  }

  // Extract description: lines between the blockquote and ## Tasks
  // Skip the "## Overview" heading if present
  const metaIdx = lines.indexOf(metaLine ?? "");
  const tasksIdx = lines.findIndex((l) => l.startsWith("## Tasks"));
  let description: string | undefined;
  if (metaIdx >= 0 && tasksIdx > metaIdx + 1) {
    const descLines = lines
      .slice(metaIdx + 1, tasksIdx)
      .filter((l) => l.trim().length > 0 && l.trim() !== "## Overview");
    if (descLines.length > 0) {
      description = descLines.join("\n").trim();
    }
  }

  // Parse task items
  const parsed: ParsedLine[] = [];
  for (const line of lines) {
    const match = line.match(ITEM_RE);
    if (!match) continue;

    const indent = match[1].length / 2;
    const checkbox = match[2];
    const priorityRaw = match[3];
    const content = match[4].trim();

    parsed.push({
      indent,
      item: {
        id: crypto.randomUUID(),
        content,
        status: parseStatus(checkbox, line),
        priority: parsePriority(priorityRaw),
      },
    });
  }

  // Build tree from flat indented list
  const items = buildTree(parsed);

  return {
    title,
    description,
    items,
    metadata: {
      source,
      createdAt: updatedAt, // best guess from what's in the markdown
      updatedAt,
    },
  };
}

function buildTree(parsed: ParsedLine[]): PlanItem[] {
  const root: PlanItem[] = [];
  const stack: { indent: number; items: PlanItem[] }[] = [
    { indent: -1, items: root },
  ];

  for (const { indent, item } of parsed) {
    // Pop the stack until we find the correct parent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    parent.items.push(item);

    // Push this item as a potential parent for children
    item.children = [];
    stack.push({ indent, items: item.children });
  }

  // Clean up empty children arrays
  const cleanChildren = (items: PlanItem[]): void => {
    for (const it of items) {
      if (it.children && it.children.length === 0) {
        delete it.children;
      } else if (it.children) {
        cleanChildren(it.children);
      }
    }
  };
  cleanChildren(root);

  return root;
}

/**
 * Check if a chat message contains a plan created by this MCP server.
 */
export function isPlanMessage(content: string): boolean {
  return content.includes(PLAN_MARKER);
}
