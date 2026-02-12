import type { CoChatConfig } from "./config.js";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface CoChatChatResponse {
  id: string;
  user_id: string;
  title: string;
  chat: Record<string, unknown>;
  updated_at: number;
  created_at: number;
  share_id?: string | null;
  archived: boolean;
  pinned?: boolean;
  meta: Record<string, unknown>;
  folder_id?: string | null;
  is_collaborative?: boolean;
  access_control?: Record<string, unknown> | null;
  link_access_level?: string | null;
}

export interface CoChatMessage {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: string;
  content: string;
  timestamp: number;
  done?: boolean;
  author?: {
    id: string;
    name: string;
    email: string;
    timestamp: number;
  };
  model?: string;
  modelName?: string;
  [key: string]: unknown;
}

export interface CoChatConfigResponse {
  default_models?: string;
  [key: string]: unknown;
}

export interface CoChatFolderResponse {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  meta: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  is_collaborative: boolean;
  is_expanded: boolean;
  access_control: Record<string, unknown> | null;
  link_access_level: string | null;
  created_at: number;
  updated_at: number;
}

export interface CoChatMemoryResponse {
  id: string;
  user_id: string;
  folder_id: string | null;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface CoChatAutomationResponse {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_enabled: boolean;
  max_runs: number | null;
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CoChatAutomationRunResponse {
  id: string;
  automation_id: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  action_results: unknown[] | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class CoChatClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "CoChatClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class CoChatClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: CoChatConfig) {
    this.baseUrl = config.cochatUrl;
    this.apiKey = config.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new CoChatClientError(
        resp.status,
        `CoChat API ${method} ${path} failed (${resp.status}): ${text}`,
      );
    }

    // Some DELETE endpoints return empty bodies
    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await resp.json()) as T;
    }
    return undefined as T;
  }

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  async getConfig(): Promise<CoChatConfigResponse> {
    return this.request<CoChatConfigResponse>("GET", "/api/config");
  }

  // -------------------------------------------------------------------------
  // Chat CRUD
  // -------------------------------------------------------------------------

  async createChat(chatData: Record<string, unknown>): Promise<CoChatChatResponse> {
    return this.request<CoChatChatResponse>("POST", "/api/v1/chats/new", {
      chat: chatData,
    });
  }

  async getChat(chatId: string): Promise<CoChatChatResponse> {
    return this.request<CoChatChatResponse>("GET", `/api/v1/chats/${chatId}`);
  }

  async updateChat(
    chatId: string,
    chatData: Record<string, unknown>,
  ): Promise<CoChatChatResponse> {
    return this.request<CoChatChatResponse>(
      "POST",
      `/api/v1/chats/${chatId}`,
      { chat: chatData },
    );
  }

  async updateMessage(
    chatId: string,
    messageId: string,
    content: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/api/v1/chats/${chatId}/messages/${messageId}`,
      { content },
    );
  }

  // -------------------------------------------------------------------------
  // Chat collaboration
  // -------------------------------------------------------------------------

  async enableCollaboration(chatId: string): Promise<CoChatChatResponse> {
    return this.request<CoChatChatResponse>(
      "POST",
      `/api/v1/chats/${chatId}/collaboration/enable`,
      { enabled: true },
    );
  }

  async setLinkAccess(
    chatId: string,
    level: "read" | "write" | "restricted",
  ): Promise<CoChatChatResponse> {
    return this.request<CoChatChatResponse>(
      "POST",
      `/api/v1/chats/${chatId}/collaboration/link-access`,
      { link_access_level: level },
    );
  }

  async inviteUsers(
    chatId: string,
    emails: string[],
    permission: "read" | "write" = "write",
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/api/v1/chats/${chatId}/collaboration/invite`,
      {
        user_emails: emails,
        user_ids: [],
        group_ids: [],
        permission,
      },
    );
  }

  async moveChatToFolder(
    chatId: string,
    folderId: string,
  ): Promise<CoChatChatResponse> {
    return this.request<CoChatChatResponse>(
      "POST",
      `/api/v1/chats/${chatId}/folder`,
      { folder_id: folderId },
    );
  }

  async listChats(): Promise<CoChatChatResponse[]> {
    return this.request<CoChatChatResponse[]>("GET", "/api/v1/chats/");
  }

  // -------------------------------------------------------------------------
  // Folders (Projects)
  // -------------------------------------------------------------------------

  async createFolder(
    name: string,
    meta?: Record<string, unknown>,
    data?: Record<string, unknown>,
  ): Promise<CoChatFolderResponse> {
    return this.request<CoChatFolderResponse>("POST", "/api/v1/folders/", {
      name,
      ...(meta ? { meta } : {}),
      ...(data ? { data } : {}),
    });
  }

  async getFolder(id: string): Promise<CoChatFolderResponse> {
    return this.request<CoChatFolderResponse>("GET", `/api/v1/folders/${id}`);
  }

  async updateFolder(
    id: string,
    updates: {
      name?: string;
      meta?: Record<string, unknown>;
      data?: Record<string, unknown>;
    },
  ): Promise<CoChatFolderResponse> {
    return this.request<CoChatFolderResponse>(
      "POST",
      `/api/v1/folders/${id}/update`,
      updates,
    );
  }

  async listFolders(): Promise<CoChatFolderResponse[]> {
    return this.request<CoChatFolderResponse[]>("GET", "/api/v1/folders/");
  }

  // -------------------------------------------------------------------------
  // Memories
  // -------------------------------------------------------------------------

  async addMemory(
    content: string,
    folderId?: string,
  ): Promise<CoChatMemoryResponse> {
    return this.request<CoChatMemoryResponse>("POST", "/api/v1/memories/add", {
      content,
      ...(folderId ? { folder_id: folderId } : {}),
    });
  }

  async queryMemories(
    content: string,
    k?: number,
    folderId?: string,
  ): Promise<CoChatMemoryResponse[]> {
    return this.request<CoChatMemoryResponse[]>(
      "POST",
      "/api/v1/memories/query",
      {
        content,
        ...(k !== undefined ? { k } : {}),
        ...(folderId ? { folder_id: folderId } : {}),
      },
    );
  }

  async listMemories(folderId?: string): Promise<CoChatMemoryResponse[]> {
    const path = folderId
      ? `/api/v1/memories/?folder_id=${encodeURIComponent(folderId)}`
      : "/api/v1/memories/";
    return this.request<CoChatMemoryResponse[]>("GET", path);
  }

  async deleteMemory(id: string): Promise<void> {
    await this.request<void>("DELETE", `/api/v1/memories/${id}`);
  }

  // -------------------------------------------------------------------------
  // Automations
  // -------------------------------------------------------------------------

  async listAutomations(): Promise<CoChatAutomationResponse[]> {
    return this.request<CoChatAutomationResponse[]>(
      "GET",
      "/api/v1/automations/",
    );
  }

  async triggerAutomation(
    id: string,
  ): Promise<CoChatAutomationRunResponse> {
    return this.request<CoChatAutomationRunResponse>(
      "POST",
      `/api/v1/automations/${id}/run`,
    );
  }

  async getAutomationRuns(
    id: string,
  ): Promise<CoChatAutomationRunResponse[]> {
    return this.request<CoChatAutomationRunResponse[]>(
      "GET",
      `/api/v1/automations/${id}/runs`,
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async getDefaultModel(): Promise<string> {
    const config = await this.getConfig();
    const defaultModels = config.default_models;
    if (typeof defaultModels === "string" && defaultModels.length > 0) {
      return defaultModels.split(",")[0].trim();
    }
    return "openrouter_manifold.anthropic/claude-sonnet-4";
  }

  extractMessages(chat: CoChatChatResponse): CoChatMessage[] {
    const chatData = chat.chat as Record<string, unknown>;
    const history = chatData.history as
      | { messages: Record<string, CoChatMessage> }
      | undefined;

    if (!history?.messages) return [];

    return Object.values(history.messages)
      .map((m) => ({
        ...m,
        // Normalize null/undefined content to empty string
        content: m.content ?? "",
      }))
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }

  chatUrl(chatId: string): string {
    return `${this.baseUrl}/c/${chatId}`;
  }

  folderUrl(folderId: string): string {
    return `${this.baseUrl}/f/${folderId}`;
  }
}
