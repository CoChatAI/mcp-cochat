import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";

export const MemoryDeleteSchema = z.object({
  memory_id: z.string().describe("ID of the memory to delete"),
});

export type MemoryDeleteInput = z.infer<typeof MemoryDeleteSchema>;

export async function memoryDelete(
  client: CoChatClient,
  input: MemoryDeleteInput,
): Promise<string> {
  await client.deleteMemory(input.memory_id);
  return `Memory ${input.memory_id} deleted successfully.`;
}
