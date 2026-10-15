import type {
  Block, LlmProvider, Message, ProviderRequest, ProviderResponse, ToolResultBlock, ToolUseBlock, Usage,
} from "../types";

export type ScriptStep =
  | { content: Block[]; stopReason?: ProviderResponse["stopReason"]; usage?: Partial<Usage> }
  | ((req: ProviderRequest, callIndex: number) => ScriptStep);

const approxTokens = (s: string) => Math.ceil(s.length / 4);

/** Deterministic provider: replays scripted responses. Used by unit tests, CI and offline demo. */
export class FakeProvider implements LlmProvider {
  readonly name = "fake";
  readonly model = "fake-model";
  calls = 0;
  readonly requests: ProviderRequest[] = [];

  constructor(private readonly script: ScriptStep[]) {}

  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    this.requests.push(structuredClone(req));
    let step: ScriptStep | undefined = this.script[Math.min(this.calls, this.script.length - 1)];
    const idx = this.calls++;
    while (typeof step === "function") step = step(req, idx);
    if (!step) throw new Error("FakeProvider: empty script");
    const hasToolUse = step.content.some((b) => b.type === "tool_use");
    const inText = JSON.stringify(req.messages) + req.system;
    return {
      content: step.content,
      stopReason: step.stopReason ?? (hasToolUse ? "tool_use" : "end_turn"),
      usage: {
        inputTokens: approxTokens(inText),
        outputTokens: approxTokens(JSON.stringify(step.content)),
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        ...step.usage,
      },
    };
  }
}

export const toolUse = (id: string, name: string, input: unknown): ToolUseBlock => ({ type: "tool_use", id, name, input });
export const text = (t: string): Block => ({ type: "text", text: t });

function toolResults(messages: Message[], toolName: string): unknown[] {
  // Find tool_results whose originating tool_use had this name.
  const names = new Map<string, string>();
  const out: unknown[] = [];
  for (const m of messages)
    for (const b of m.content) {
      if (b.type === "tool_use") names.set(b.id, b.name);
      if (b.type === "tool_result" && names.get((b as ToolResultBlock).toolUseId) === toolName && !b.isError) {
        try { out.push(JSON.parse(b.content)); } catch { /* ignore */ }
      }
    }
  return out;
}

/**
 * A scripted "analyst" used for the offline CLI demo and the fake-provider evals.
 * Plan: list campaigns -> report for each non-draft campaign -> (optional) playbook -> answer.
 * It is deterministic code standing in for the LLM; it proves the plumbing, not model quality.
 */
export function demoAnalystScript(question: string): ScriptStep[] {
  const wantsAdvice = /improve|advice|tip|best practice|how (do|can|to)|increase|fix|why/i.test(question);
  const wantsSpend = /spend|cost|budget/i.test(question);
  return [
    { content: [text("I'll start by listing campaigns."), toolUse("t1", "list_campaigns", {})] },
    (req) => {
      const page = toolResults(req.messages, "list_campaigns")[0] as { items: { id: string; status: string }[] } | undefined;
      const ids = (page?.items ?? []).filter((c) => c.status !== "DRAFT").map((c) => c.id);
      return { content: ids.map((id, i) => toolUse(`r${i}`, "get_campaign_report", { campaignId: id })) };
    },
    (req) => {
      if (!wantsAdvice) return finalAnswer(req, wantsSpend, []);
      return { content: [toolUse("p1", "search_playbook", { query: question })] };
    },
    (req) => finalAnswer(req, wantsSpend, toolResults(req.messages, "search_playbook")[0] as any[] | undefined ?? []),
  ];
}

function finalAnswer(req: ProviderRequest, spend: boolean, playbook: { section: string; text: string }[]): ScriptStep {
  const campaigns = ((toolResults(req.messages, "list_campaigns")[0] as any)?.items ?? []) as { id: string; name: string }[];
  const reports = toolResults(req.messages, "get_campaign_report") as { campaignId: string; ctr: number; spendCents: number; impressions: number }[];
  const nameOf = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;
  const rows = reports.filter((r) => r.impressions > 0);
  const byCtr = [...rows].sort((a, b) => b.ctr - a.ctr);
  const bySpend = [...rows].sort((a, b) => b.spendCents - a.spendCents);
  const best = byCtr[0];
  let ans = best
    ? `Best CTR: ${nameOf(best.campaignId)} (${best.campaignId}) at ${(best.ctr * 100).toFixed(2)}%. Top 3: ` +
      byCtr.slice(0, 3).map((r) => `${nameOf(r.campaignId)} ${(r.ctr * 100).toFixed(2)}%`).join(", ") + "."
    : "No campaign has impression data yet.";
  if (spend && bySpend[0]) ans += ` Highest spend: ${nameOf(bySpend[0].campaignId)} at $${(bySpend[0].spendCents / 100).toFixed(2)}.`;
  if (playbook[0]) ans += ` Playbook tip (${playbook[0].section}): ${playbook[0].text.split("\n")[0]}`;
  return { content: [text(ans)] };
}
