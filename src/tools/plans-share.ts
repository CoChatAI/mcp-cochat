import { z } from "zod";
import type { CoChatClient } from "../cochat-client.js";
import { trackPlan } from "../config.js";
import { planToMarkdown } from "../plan-format.js";
import { PlanItemSchema } from "../schemas.js";
import { resolveCurrentProjectFolder } from "./projects-add.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const PlansShareSchema = z.object({
  title: z.string().describe("Title of the plan"),
  description: z
    .string()
    .optional()
    .describe(
      "The COMPLETE plan document body in markdown. Include: design rationale, " +
      "architecture decisions, data flow, technical approach, edge cases, and any " +
      "other context engineers need to review. This is rendered as the main content " +
      "of the shared document -- NOT a summary. Use full markdown formatting " +
      "(headers, lists, code blocks)."
    ),
  items: z
    .array(PlanItemSchema)
    .describe("List of plan task items"),
  invite_emails: z
    .array(z.string())
    .optional()
    .describe("Email addresses of engineers to invite to collaborate"),
});

export type PlansShareInput = z.infer<typeof PlansShareSchema>;

// ---------------------------------------------------------------------------
// Tool implementation
// ---------------------------------------------------------------------------

export async function plansShare(
  client: CoChatClient,
  input: PlansShareInput,
): Promise<string> {
  const now = new Date().toISOString();

  // Resolve project folder (lazy create if needed)
  const project = await resolveCurrentProjectFolder(client);

  // Build the plan markdown
  const plan = {
    title: input.title,
    description: input.description,
    items: input.items,
    metadata: {
      source: "coding-agent",
      createdAt: now,
      updatedAt: now,
    },
  };

  const markdown = planToMarkdown(plan);

  // Resolve the default model
  const defaultModel = await client.getDefaultModel();

  // Build the chat message structure
  const messageId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  const chatData: Record<string, unknown> = {
    title: `Plan: ${input.title}`,
    models: [defaultModel],
    history: {
      messages: {
        [messageId]: {
          id: messageId,
          parentId: null,
          childrenIds: [],
          role: "assistant",
          content: markdown,
          model: defaultModel,
          modelName: "CoChat Plans",
          done: true,
          timestamp,
        },
      },
      currentId: messageId,
    },
    messages: [
      {
        id: messageId,
        role: "assistant",
        content: markdown,
        model: defaultModel,
        modelName: "CoChat Plans",
        done: true,
        timestamp,
      },
    ],
    tags: [],
    timestamp: Date.now(),
  };

  // Create the chat
  const chat = await client.createChat(chatData);

  // Move into project folder
  if (project.folderId) {
    await client.moveChatToFolder(chat.id, project.folderId);
  }

  // Enable collaboration
  await client.enableCollaboration(chat.id);

  // Set link access to write so anyone with the link can collaborate
  await client.setLinkAccess(chat.id, "write");

  // Invite users if provided
  let invitedCount = 0;
  if (input.invite_emails && input.invite_emails.length > 0) {
    await client.inviteUsers(chat.id, input.invite_emails, "write");
    invitedCount = input.invite_emails.length;
  }

  // Track this plan locally
  const url = client.chatUrl(chat.id);
  trackPlan({
    chatId: chat.id,
    planMessageId: messageId,
    title: input.title,
    createdAt: now,
    updatedAt: now,
    url,
    folderId: project.folderId,
  });

  // Build response
  const parts: string[] = [
    `Plan "${input.title}" shared successfully.`,
    ``,
    `Chat URL: ${url}`,
    `Chat ID: ${chat.id}`,
    `Project: ${project.projectName}`,
  ];

  if (invitedCount > 0) {
    parts.push(`Invited: ${invitedCount} engineer(s)`);
  }

  parts.push(
    ``,
    `Collaboration is enabled with write access via link.`,
    `Engineers can open the URL to review and provide feedback.`,
    `Use plans_pull to retrieve updates and feedback.`,
  );

  return parts.join("\n");
}
