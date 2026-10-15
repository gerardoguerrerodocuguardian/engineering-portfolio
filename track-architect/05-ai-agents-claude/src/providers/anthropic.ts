import Anthropic from "@anthropic-ai/sdk";
import type { Block, LlmProvider, ProviderRequest, ProviderResponse, StopReason } from "../types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

/**
 * Live Anthropic provider (official SDK, Messages API, manual tool use).
 * NOT exercised against the live API in this repo's CI or in the author's verification run.
 *
 * Notes:
 *  - Prompt caching: system prompt and the last tool carry cache_control, so the stable prefix
 *    (tools -> system) is cached across loop iterations and across questions.
 *  - Thinking: we send {type:"between_tools"} (Sonnet 5.5) so no thinking blocks need to be
 *    replayed in our provider-neutral history. If you enable adaptive thinking, you must echo
 *    thinking blocks back unchanged within a conversation.
 *  - tool_choice is left on auto (forced tool use is rejected on this model).
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(readonly model: string = process.env.AGENT_MODEL || DEFAULT_MODEL, client?: Anthropic) {
    this.client = client ?? new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  }

  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    const tools = req.tools.map((t, i) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
      ...(i === req.tools.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
    }));
    const params = {
      model: this.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      tools,
      messages: req.messages.map(toWire),
      thinking: { type: "between_tools" },
      output_config: { effort: "medium" },
    };
    // Cast: newer request fields (thinking.between_tools / output_config) may postdate the pinned SDK types.
    const res = await this.client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming);

    const content: Block[] = [];
    for (const b of res.content) {
      if (b.type === "text") content.push({ type: "text", text: b.text });
      else if (b.type === "tool_use") content.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
    }
    const stop = res.stop_reason as string | null;
    const stopReason: StopReason =
      stop === "tool_use" || stop === "end_turn" || stop === "max_tokens" || stop === "refusal" ? stop : "other";
    return {
      content,
      stopReason,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}

function toWire(m: ProviderRequest["messages"][number]): Anthropic.MessageParam {
  return {
    role: m.role,
    content: m.content.map((b) => {
      if (b.type === "text") return { type: "text" as const, text: b.text };
      if (b.type === "tool_use") return { type: "tool_use" as const, id: b.id, name: b.name, input: b.input };
      return { type: "tool_result" as const, tool_use_id: b.toolUseId, content: b.content, is_error: b.isError ?? false };
    }),
  };
}
