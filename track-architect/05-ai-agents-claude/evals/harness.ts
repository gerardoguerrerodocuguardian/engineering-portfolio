import { runAgent, type AgentResult } from "../src/agent/loop";
import type { LlmProvider } from "../src/types";
import type { ToolContext } from "../src/tools/registry";

export interface EvalCase {
  id: string;
  question: string;
  expectTools?: string[];
  answerIncludesAny?: string[];
  answerExcludes?: string[];
}

export interface CaseResult {
  id: string;
  pass: boolean;
  failures: string[];
  tokens: number;
  costUsd: number;
  latencyMs: number;
  stop: AgentResult["stop"];
}

export interface EvalReport {
  provider: string;
  model: string;
  passRate: number;
  passed: number;
  total: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  cases: CaseResult[];
}

/** Programmatic (deterministic) graders: tool use, required/forbidden substrings, clean stop. */
export function grade(c: EvalCase, r: AgentResult): string[] {
  const fails: string[] = [];
  if (r.stop !== "final") fails.push(`stop=${r.stop}`);
  for (const t of c.expectTools ?? []) if (!r.toolCalls.some((x) => x.name === t)) fails.push(`missing tool call: ${t}`);
  const ans = r.answer.toLowerCase();
  if (c.answerIncludesAny?.length && !c.answerIncludesAny.some((s) => ans.includes(s.toLowerCase())))
    fails.push(`answer lacks any of: ${c.answerIncludesAny.join(" | ")}`);
  for (const s of c.answerExcludes ?? []) if (ans.includes(s.toLowerCase())) fails.push(`answer contains forbidden: ${s}`);
  return fails;
}

export async function runEvals(
  cases: EvalCase[],
  makeProvider: (c: EvalCase) => LlmProvider,
  tools: ToolContext,
): Promise<EvalReport> {
  const results: CaseResult[] = [];
  let name = "", model = "";
  for (const c of cases) {
    const provider = makeProvider(c);
    name = provider.name; model = provider.model;
    const r = await runAgent(c.question, { provider, tools });
    const failures = grade(c, r);
    results.push({
      id: c.id, pass: failures.length === 0, failures,
      tokens: r.usage.inputTokens + r.usage.outputTokens + r.usage.cacheReadTokens + r.usage.cacheWriteTokens,
      costUsd: r.costUsd, latencyMs: r.latencyMs, stop: r.stop,
    });
  }
  const passed = results.filter((x) => x.pass).length;
  return {
    provider: name, model, passed, total: results.length,
    passRate: results.length ? passed / results.length : 0,
    totalTokens: results.reduce((a, x) => a + x.tokens, 0),
    totalCostUsd: results.reduce((a, x) => a + x.costUsd, 0),
    avgLatencyMs: results.length ? results.reduce((a, x) => a + x.latencyMs, 0) / results.length : 0,
    cases: results,
  };
}
