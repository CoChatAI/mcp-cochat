import type { z } from "zod";

/**
 * Lightweight Zod-to-JSON-Schema converter.
 *
 * The MCP SDK expects plain JSON Schema objects for tool inputSchema.
 * Rather than pulling in the full `zod-to-json-schema` package we do
 * a minimal conversion that handles the types we actually use:
 *   - object, string, number, boolean, array, enum, lazy, optional
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodTypeAny;
        properties[key] = convert(fieldSchema);

        // Check if the field is optional
        if (!isOptional(fieldSchema)) {
          required.push(key);
        }
      }

      const result: Record<string, unknown> = {
        type: "object",
        properties,
      };

      if (required.length > 0) {
        result.required = required;
      }

      return result;
    }

    case "ZodString": {
      const result: Record<string, unknown> = { type: "string" };
      const desc = def.description as string | undefined;
      if (desc) result.description = desc;
      return result;
    }

    case "ZodNumber": {
      const result: Record<string, unknown> = { type: "number" };
      const desc = def.description as string | undefined;
      if (desc) result.description = desc;
      return result;
    }

    case "ZodBoolean": {
      const result: Record<string, unknown> = { type: "boolean" };
      const desc = def.description as string | undefined;
      if (desc) result.description = desc;
      return result;
    }

    case "ZodArray": {
      const innerType = def.type as z.ZodTypeAny;
      const result: Record<string, unknown> = {
        type: "array",
        items: convert(innerType),
      };
      const desc = def.description as string | undefined;
      if (desc) result.description = desc;
      return result;
    }

    case "ZodEnum": {
      const values = (def.values as string[]) ?? [];
      return { type: "string", enum: values };
    }

    case "ZodOptional": {
      const inner = def.innerType as z.ZodTypeAny;
      const result = convert(inner);
      // Carry over description from the optional wrapper
      const desc = def.description as string | undefined;
      if (desc) result.description = desc;
      return result;
    }

    case "ZodLazy": {
      // Lazy schemas can cause infinite recursion. Return a generic object
      // as a safe fallback. Prefer non-recursive schemas instead of z.lazy().
      return { type: "object" };
    }

    case "ZodDefault": {
      const inner = def.innerType as z.ZodTypeAny;
      return convert(inner);
    }

    default: {
      // Fallback – treat as generic object
      const result: Record<string, unknown> = {};
      const desc = def.description as string | undefined;
      if (desc) result.description = desc;
      return result;
    }
  }
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;
  if (typeName === "ZodOptional") return true;
  if (typeName === "ZodDefault") return true;
  return false;
}
