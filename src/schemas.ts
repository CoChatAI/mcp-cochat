import { z } from "zod";

/**
 * Shared Zod schemas for plan items.
 *
 * We explicitly define one level of nesting (children) rather than using
 * z.lazy() for recursion, because recursive Zod schemas cause stack
 * overflows when converting to JSON Schema for MCP tool registration.
 */

const ChildPlanItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  priority: z.enum(["high", "medium", "low"]),
});

export const PlanItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  priority: z.enum(["high", "medium", "low"]),
  children: z.array(ChildPlanItemSchema).optional(),
});

export type PlanItemInput = z.infer<typeof PlanItemSchema>;
