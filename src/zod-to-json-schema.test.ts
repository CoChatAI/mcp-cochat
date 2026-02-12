import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "./zod-to-json-schema.js";

describe("zodToJsonSchema", () => {
  // -----------------------------------------------------------------------
  // Primitives
  // -----------------------------------------------------------------------

  it("converts a simple string field", () => {
    const schema = z.object({ name: z.string() });
    const json = zodToJsonSchema(schema);

    expect(json).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    });
  });

  it("converts a number field", () => {
    const schema = z.object({ count: z.number() });
    const json = zodToJsonSchema(schema);

    expect(json).toEqual({
      type: "object",
      properties: {
        count: { type: "number" },
      },
      required: ["count"],
    });
  });

  it("converts a boolean field", () => {
    const schema = z.object({ active: z.boolean() });
    const json = zodToJsonSchema(schema);

    expect(json).toEqual({
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
      required: ["active"],
    });
  });

  // -----------------------------------------------------------------------
  // Required vs optional
  // -----------------------------------------------------------------------

  it("puts required fields in the required array", () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
    });
    const json = zodToJsonSchema(schema);
    expect(json.required).toEqual(["a", "b"]);
  });

  it("does NOT include optional fields in the required array", () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    });
    const json = zodToJsonSchema(schema);
    expect(json.required).toEqual(["name"]);
  });

  it("omits the required array when all fields are optional", () => {
    const schema = z.object({
      a: z.string().optional(),
      b: z.number().optional(),
    });
    const json = zodToJsonSchema(schema);
    expect(json.required).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Arrays
  // -----------------------------------------------------------------------

  it("converts an array of strings", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });
    const json = zodToJsonSchema(schema);

    expect((json.properties as Record<string, unknown>).tags).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("converts an array of objects", () => {
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.string(),
          value: z.number(),
        }),
      ),
    });
    const json = zodToJsonSchema(schema);
    const items = (json.properties as Record<string, unknown>).items as Record<
      string,
      unknown
    >;

    expect(items.type).toBe("array");
    expect(items.items).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
        value: { type: "number" },
      },
      required: ["id", "value"],
    });
  });

  // -----------------------------------------------------------------------
  // Enum
  // -----------------------------------------------------------------------

  it("converts an enum field", () => {
    const schema = z.object({
      status: z.enum(["pending", "active", "done"]),
    });
    const json = zodToJsonSchema(schema);

    expect((json.properties as Record<string, unknown>).status).toEqual({
      type: "string",
      enum: ["pending", "active", "done"],
    });
  });

  // -----------------------------------------------------------------------
  // Nested objects
  // -----------------------------------------------------------------------

  it("converts nested objects", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        address: z.object({
          city: z.string(),
        }),
      }),
    });
    const json = zodToJsonSchema(schema);
    const user = (json.properties as Record<string, unknown>).user as Record<
      string,
      unknown
    >;

    expect(user.type).toBe("object");
    const userProps = user.properties as Record<string, unknown>;
    expect(userProps.name).toEqual({ type: "string" });

    const address = userProps.address as Record<string, unknown>;
    expect(address.type).toBe("object");
    expect((address.properties as Record<string, unknown>).city).toEqual({
      type: "string",
    });
  });

  // -----------------------------------------------------------------------
  // Description annotation
  // -----------------------------------------------------------------------

  it("carries through description annotations on strings", () => {
    const schema = z.object({
      name: z.string().describe("The user's name"),
    });
    const json = zodToJsonSchema(schema);
    const nameField = (json.properties as Record<string, unknown>)
      .name as Record<string, unknown>;

    expect(nameField.description).toBe("The user's name");
  });

  it("carries through description annotations on optional fields", () => {
    const schema = z.object({
      bio: z.string().optional().describe("A short bio"),
    });
    const json = zodToJsonSchema(schema);
    const bioField = (json.properties as Record<string, unknown>)
      .bio as Record<string, unknown>;

    expect(bioField.description).toBe("A short bio");
  });

  it("carries through description on number fields", () => {
    const schema = z.object({
      age: z.number().describe("Age in years"),
    });
    const json = zodToJsonSchema(schema);
    const ageField = (json.properties as Record<string, unknown>)
      .age as Record<string, unknown>;

    expect(ageField.description).toBe("Age in years");
  });

  // -----------------------------------------------------------------------
  // ZodLazy fallback
  // -----------------------------------------------------------------------

  it("converts ZodLazy to a safe generic object fallback", () => {
    const schema = z.lazy(() => z.object({ x: z.string() }));
    const json = zodToJsonSchema(schema);
    expect(json).toEqual({ type: "object" });
  });

  // -----------------------------------------------------------------------
  // ZodDefault
  // -----------------------------------------------------------------------

  it("converts ZodDefault by unwrapping the inner type", () => {
    const schema = z.object({
      count: z.number().default(10),
    });
    const json = zodToJsonSchema(schema);

    // Default fields are treated as optional (not in required)
    expect(json.required).toBeUndefined();
    expect((json.properties as Record<string, unknown>).count).toEqual({
      type: "number",
    });
  });
});
