/** Provider-neutral message model. Providers translate to/from their own wire format. */
export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ToolResultBlock = {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
};
export type Block = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: "user" | "assistant";
  content: Block[];
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool input. */
  inputSchema: Record<string, unknown>;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface ProviderRequest {
  system: string;
  tools: ToolSpec[];
  messages: Message[];
  maxTokens: number;
}

export interface ProviderResponse {
  content: Block[];
  stopReason: StopReason;
  usage: Usage;
}

/** The only thing the agent loop knows about an LLM. */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(req: ProviderRequest): Promise<ProviderResponse>;
}

export const emptyUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});
