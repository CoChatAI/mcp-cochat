import { describe, it, expect } from "vitest";
import { PlanItemSchema } from "./schemas.js";
import { PlansShareSchema } from "./tools/plans-share.js";
import { PlansPullSchema } from "./tools/plans-pull.js";
import { PlansUpdateSchema } from "./tools/plans-update.js";
import { ProjectsAddSchema } from "./tools/projects-add.js";
import { ProjectsGetSchema } from "./tools/projects-get.js";
import { ProjectsSetContextSchema } from "./tools/projects-set-context.js";
import { MemoryQuerySchema } from "./tools/memory-query.js";
import { MemoryAddSchema } from "./tools/memory-add.js";
import { MemoryDeleteSchema } from "./tools/memory-delete.js";
import { AutomationsTriggerSchema } from "./tools/automations-trigger.js";
import { AutomationsRunsSchema } from "./tools/automations-runs.js";

// ---------------------------------------------------------------------------
// PlanItemSchema
// ---------------------------------------------------------------------------

describe("PlanItemSchema", () => {
  it("parses a valid plan item without children", () => {
    const result = PlanItemSchema.safeParse({
      id: "item-1",
      content: "Implement feature X",
      status: "pending",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid plan item with children", () => {
    const result = PlanItemSchema.safeParse({
      id: "item-1",
      content: "Parent task",
      status: "in_progress",
      priority: "medium",
      children: [
        {
          id: "child-1",
          content: "Sub-task A",
          status: "completed",
          priority: "low",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toHaveLength(1);
    }
  });

  it("rejects missing required fields", () => {
    const result = PlanItemSchema.safeParse({
      id: "item-1",
      // missing content, status, priority
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = PlanItemSchema.safeParse({
      id: "item-1",
      content: "Task",
      status: "invalid_status",
      priority: "high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = PlanItemSchema.safeParse({
      id: "item-1",
      content: "Task",
      status: "pending",
      priority: "critical", // not a valid value
    });
    expect(result.success).toBe(false);
  });

  it("allows children to be omitted (optional)", () => {
    const result = PlanItemSchema.safeParse({
      id: "item-1",
      content: "Task",
      status: "pending",
      priority: "high",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// PlansShareSchema
// ---------------------------------------------------------------------------

describe("PlansShareSchema", () => {
  it("parses valid input", () => {
    const result = PlansShareSchema.safeParse({
      title: "Test Plan",
      items: [
        { id: "1", content: "Task", status: "pending", priority: "high" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = PlansShareSchema.safeParse({
      items: [
        { id: "1", content: "Task", status: "pending", priority: "high" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional description and invite_emails", () => {
    const result = PlansShareSchema.safeParse({
      title: "Plan",
      description: "Some description",
      items: [],
      invite_emails: ["alice@example.com"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Some description");
      expect(result.data.invite_emails).toEqual(["alice@example.com"]);
    }
  });
});

// ---------------------------------------------------------------------------
// PlansPullSchema
// ---------------------------------------------------------------------------

describe("PlansPullSchema", () => {
  it("parses with optional chat_id", () => {
    expect(PlansPullSchema.safeParse({}).success).toBe(true);
    expect(PlansPullSchema.safeParse({ chat_id: "abc-123" }).success).toBe(true);
  });

  it("rejects non-string chat_id", () => {
    expect(PlansPullSchema.safeParse({ chat_id: 123 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PlansUpdateSchema
// ---------------------------------------------------------------------------

describe("PlansUpdateSchema", () => {
  it("parses valid input with required chat_id and items", () => {
    const result = PlansUpdateSchema.safeParse({
      chat_id: "chat-abc",
      items: [
        { id: "1", content: "Updated task", status: "completed", priority: "medium" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing chat_id", () => {
    const result = PlansUpdateSchema.safeParse({
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional description", () => {
    const result = PlansUpdateSchema.safeParse({
      chat_id: "chat-abc",
      items: [],
      description: "Updated overview",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Updated overview");
    }
  });
});

// ---------------------------------------------------------------------------
// ProjectsAddSchema
// ---------------------------------------------------------------------------

describe("ProjectsAddSchema", () => {
  it("parses with no fields (all optional)", () => {
    expect(ProjectsAddSchema.safeParse({}).success).toBe(true);
  });

  it("parses with optional name", () => {
    const result = ProjectsAddSchema.safeParse({ name: "my-project" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("my-project");
    }
  });
});

// ---------------------------------------------------------------------------
// ProjectsGetSchema
// ---------------------------------------------------------------------------

describe("ProjectsGetSchema", () => {
  it("parses with no fields (all optional)", () => {
    expect(ProjectsGetSchema.safeParse({}).success).toBe(true);
  });

  it("parses with optional folder_id", () => {
    const result = ProjectsGetSchema.safeParse({ folder_id: "folder-123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folder_id).toBe("folder-123");
    }
  });
});

// ---------------------------------------------------------------------------
// ProjectsSetContextSchema
// ---------------------------------------------------------------------------

describe("ProjectsSetContextSchema", () => {
  it("parses valid input with required system_prompt", () => {
    const result = ProjectsSetContextSchema.safeParse({
      system_prompt: "You are a helpful assistant.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing system_prompt", () => {
    const result = ProjectsSetContextSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional folder_id", () => {
    const result = ProjectsSetContextSchema.safeParse({
      system_prompt: "prompt",
      folder_id: "folder-abc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folder_id).toBe("folder-abc");
    }
  });
});

// ---------------------------------------------------------------------------
// MemoryQuerySchema
// ---------------------------------------------------------------------------

describe("MemoryQuerySchema", () => {
  it("parses valid input with required query", () => {
    const result = MemoryQuerySchema.safeParse({ query: "architecture decisions" });
    expect(result.success).toBe(true);
  });

  it("rejects missing query", () => {
    expect(MemoryQuerySchema.safeParse({}).success).toBe(false);
  });

  it("accepts optional count", () => {
    const result = MemoryQuerySchema.safeParse({ query: "test", count: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(10);
    }
  });
});

// ---------------------------------------------------------------------------
// MemoryAddSchema
// ---------------------------------------------------------------------------

describe("MemoryAddSchema", () => {
  it("parses valid input with required content", () => {
    const result = MemoryAddSchema.safeParse({ content: "Some memory content" });
    expect(result.success).toBe(true);
  });

  it("rejects missing content", () => {
    expect(MemoryAddSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MemoryDeleteSchema
// ---------------------------------------------------------------------------

describe("MemoryDeleteSchema", () => {
  it("parses valid input with required memory_id", () => {
    const result = MemoryDeleteSchema.safeParse({ memory_id: "mem-123" });
    expect(result.success).toBe(true);
  });

  it("rejects missing memory_id", () => {
    expect(MemoryDeleteSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AutomationsTriggerSchema
// ---------------------------------------------------------------------------

describe("AutomationsTriggerSchema", () => {
  it("parses valid input with required automation_id", () => {
    const result = AutomationsTriggerSchema.safeParse({
      automation_id: "auto-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing automation_id", () => {
    expect(AutomationsTriggerSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AutomationsRunsSchema
// ---------------------------------------------------------------------------

describe("AutomationsRunsSchema", () => {
  it("parses valid input with required automation_id", () => {
    const result = AutomationsRunsSchema.safeParse({
      automation_id: "auto-456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing automation_id", () => {
    expect(AutomationsRunsSchema.safeParse({}).success).toBe(false);
  });
});
