/**
 * Amazon Bedrock provider: DOCUMENTED STUB, not implemented, not tested.
 *
 * How it would plug in: implement LlmProvider and translate our neutral Message/Block types
 * to the Bedrock Converse API (or the Anthropic Messages API on Bedrock via the
 * `@anthropic-ai/bedrock-sdk` client). Nothing else in the codebase changes.
 *
 * Converse mapping sketch:
 *   system            -> `system: [{ text }]` (+ a `cachePoint` block where the model supports it)
 *   ToolSpec          -> `toolConfig.tools[].toolSpec { name, description, inputSchema: { json } }`
 *   tool_use block    -> `{ toolUse: { toolUseId, name, input } }`
 *   tool_result block -> `{ toolResult: { toolUseId, content: [{ text }], status } }`
 *   stopReason        -> "tool_use" | "end_turn" | "max_tokens" map 1:1
 *   usage             -> `usage.inputTokens / outputTokens / cacheReadInputTokens`
 *
 * Auth: AWS credential chain (IAM role), never static keys in code. Pick the Bedrock model ID or
 * inference-profile ID available in your region.
 */
import type { LlmProvider, ProviderRequest, ProviderResponse } from "../types";

export class BedrockProviderStub implements LlmProvider {
  readonly name = "bedrock-stub";
  constructor(readonly model: string) {}
  async complete(_req: ProviderRequest): Promise<ProviderResponse> {
    throw new Error("BedrockProviderStub is a documented stub and is not implemented.");
  }
}
