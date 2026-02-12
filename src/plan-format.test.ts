import { describe, it, expect } from "vitest";
import {
  planToMarkdown,
  markdownToPlan,
  isPlanMessage,
  type Plan,
  type PlanItem,
} from "./plan-format.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    title: "Test Plan",
    description: "A test plan description",
    items: [
      {
        id: "item-1",
        content: "First task",
        status: "pending",
        priority: "high",
      },
    ],
    metadata: {
      source: "test-agent",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe("planToMarkdown / markdownToPlan round-trip", () => {
  it("round-trips a basic plan", () => {
    const plan = makePlan();
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);

    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe(plan.title);
    expect(parsed!.description).toBe(plan.description);
    expect(parsed!.items).toHaveLength(1);
    expect(parsed!.items[0].content).toBe("First task");
    expect(parsed!.items[0].status).toBe("pending");
    expect(parsed!.items[0].priority).toBe("high");
    expect(parsed!.metadata.source).toBe("test-agent");
    expect(parsed!.metadata.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("round-trips a plan with no description", () => {
    const plan = makePlan({ description: undefined });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);

    expect(parsed).not.toBeNull();
    expect(parsed!.description).toBeUndefined();
  });

  it("round-trips with empty items array", () => {
    const plan = makePlan({ items: [] });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);

    expect(parsed).not.toBeNull();
    expect(parsed!.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// All statuses
// ---------------------------------------------------------------------------

describe("planToMarkdown handles all statuses", () => {
  const statuses: Array<{
    status: PlanItem["status"];
    expectChecked: boolean;
    extraText?: string;
  }> = [
    { status: "pending", expectChecked: false },
    { status: "in_progress", expectChecked: false, extraText: "*(in progress)*" },
    { status: "completed", expectChecked: true },
    { status: "cancelled", expectChecked: false, extraText: "~~cancelled~~" },
  ];

  for (const { status, expectChecked, extraText } of statuses) {
    it(`serializes status="${status}" correctly`, () => {
      const plan = makePlan({
        items: [
          { id: "s1", content: "Task", status, priority: "medium" },
        ],
      });
      const md = planToMarkdown(plan);
      const checkbox = expectChecked ? "[x]" : "[ ]";
      expect(md).toContain(checkbox);
      if (extraText) {
        expect(md).toContain(extraText);
      }
    });

    it(`round-trips status="${status}"`, () => {
      const plan = makePlan({
        items: [
          { id: "s1", content: "Task", status, priority: "medium" },
        ],
      });
      const md = planToMarkdown(plan);
      const parsed = markdownToPlan(md);
      expect(parsed).not.toBeNull();
      expect(parsed!.items[0].status).toBe(status);
    });
  }
});

// ---------------------------------------------------------------------------
// All priorities
// ---------------------------------------------------------------------------

describe("planToMarkdown handles all priorities", () => {
  const priorities: Array<{
    priority: PlanItem["priority"];
    label: string;
  }> = [
    { priority: "high", label: "**[HIGH]**" },
    { priority: "medium", label: "**[MED]**" },
    { priority: "low", label: "**[LOW]**" },
  ];

  for (const { priority, label } of priorities) {
    it(`serializes priority="${priority}" as ${label}`, () => {
      const plan = makePlan({
        items: [
          { id: "p1", content: "Task", status: "pending", priority },
        ],
      });
      const md = planToMarkdown(plan);
      expect(md).toContain(label);
    });

    it(`round-trips priority="${priority}"`, () => {
      const plan = makePlan({
        items: [
          { id: "p1", content: "Task", status: "pending", priority },
        ],
      });
      const md = planToMarkdown(plan);
      const parsed = markdownToPlan(md);
      expect(parsed).not.toBeNull();
      expect(parsed!.items[0].priority).toBe(priority);
    });
  }
});

// ---------------------------------------------------------------------------
// Nested children
// ---------------------------------------------------------------------------

describe("nested children items", () => {
  it("round-trips items with children", () => {
    const plan = makePlan({
      items: [
        {
          id: "parent-1",
          content: "Parent task",
          status: "in_progress",
          priority: "high",
          children: [
            {
              id: "child-1",
              content: "Child task A",
              status: "completed",
              priority: "medium",
            },
            {
              id: "child-2",
              content: "Child task B",
              status: "pending",
              priority: "low",
            },
          ],
        },
      ],
    });

    const md = planToMarkdown(plan);

    // Children should be indented
    expect(md).toContain("  - [x] **[MED]** Child task A");
    expect(md).toContain("  - [ ] **[LOW]** Child task B");

    const parsed = markdownToPlan(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.items).toHaveLength(1);
    expect(parsed!.items[0].children).toHaveLength(2);
    expect(parsed!.items[0].children![0].content).toBe("Child task A");
    expect(parsed!.items[0].children![0].status).toBe("completed");
    expect(parsed!.items[0].children![1].content).toBe("Child task B");
    expect(parsed!.items[0].children![1].priority).toBe("low");
  });

  it("parent without children has no children property after round-trip", () => {
    const plan = makePlan({
      items: [
        { id: "solo", content: "Solo task", status: "pending", priority: "medium" },
      ],
    });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);
    expect(parsed!.items[0].children).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Description with markdown formatting
// ---------------------------------------------------------------------------

describe("description with markdown formatting", () => {
  it("preserves markdown in description", () => {
    const description = [
      "### Architecture",
      "",
      "We use a **microservices** approach.",
      "",
      "```typescript",
      "const x = 42;",
      "```",
    ].join("\n");

    const plan = makePlan({ description });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);

    expect(parsed).not.toBeNull();
    // The description is captured between the blockquote and ## Tasks
    expect(parsed!.description).toContain("### Architecture");
    expect(parsed!.description).toContain("**microservices**");
    expect(parsed!.description).toContain("const x = 42;");
  });
});

// ---------------------------------------------------------------------------
// isPlanMessage
// ---------------------------------------------------------------------------

describe("isPlanMessage", () => {
  it("returns true for plan markdown", () => {
    const plan = makePlan();
    const md = planToMarkdown(plan);
    expect(isPlanMessage(md)).toBe(true);
  });

  it("returns false for regular text", () => {
    expect(isPlanMessage("Hello, this is a normal message")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isPlanMessage("")).toBe(false);
  });

  it("returns false for markdown without plan marker", () => {
    expect(isPlanMessage("# Plan: My Plan\n\n- [ ] Task 1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Overview heading is stripped from description
// ---------------------------------------------------------------------------

describe("Overview heading parsing", () => {
  it("strips ## Overview from parsed description", () => {
    const plan = makePlan({ description: "Some overview text" });
    const md = planToMarkdown(plan);

    // The markdown should contain "## Overview"
    expect(md).toContain("## Overview");

    const parsed = markdownToPlan(md);
    expect(parsed).not.toBeNull();
    // But the parsed description should NOT contain "## Overview"
    expect(parsed!.description).not.toContain("## Overview");
    expect(parsed!.description).toBe("Some overview text");
  });
});

// ---------------------------------------------------------------------------
// Special characters
// ---------------------------------------------------------------------------

describe("special characters in content", () => {
  it("handles quotes in item content", () => {
    const plan = makePlan({
      items: [
        {
          id: "q1",
          content: 'Use "quotes" and \'apostrophes\'',
          status: "pending",
          priority: "medium",
        },
      ],
    });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.items[0].content).toContain('"quotes"');
    expect(parsed!.items[0].content).toContain("'apostrophes'");
  });

  it("handles brackets in item content", () => {
    const plan = makePlan({
      items: [
        {
          id: "b1",
          content: "Implement Array<string> and Record<K, V>",
          status: "pending",
          priority: "high",
        },
      ],
    });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.items[0].content).toContain("Array<string>");
  });

  it("handles special characters in title", () => {
    const plan = makePlan({ title: "Plan: Fix & Improve (v2.0)" });
    const md = planToMarkdown(plan);
    const parsed = markdownToPlan(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe("Plan: Fix & Improve (v2.0)");
  });
});

// ---------------------------------------------------------------------------
// markdownToPlan returns null for non-plan content
// ---------------------------------------------------------------------------

describe("markdownToPlan edge cases", () => {
  it("returns null for non-plan markdown", () => {
    expect(markdownToPlan("# Just a heading\n\nSome text")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(markdownToPlan("")).toBeNull();
  });
});
