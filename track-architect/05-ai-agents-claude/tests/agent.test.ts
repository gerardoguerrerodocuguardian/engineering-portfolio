import { describe, it, expect } from "vitest";
import { runAgent } from "../src/agent/loop";
import { FakeProvider, text, toolUse, demoAnalystScript } from "../src/providers/fake";
import { createDefaultToolContext } from "../src/runtime";
import { createLogger } from "../src/guardrails/redact";
import { GuardrailError } from "../src/guardrails/validate";

const tools = createDefaultToolContext();

describe("agent loop", () => {
  it("runs a tool then returns a final answer", async () => {
    const p = new FakeProvider([
      { content: [toolUse("a", "get_campaign_report", { campaignId: "cmp_001" })] },
      (req) => {
        const last = req.messages.at(-1)!.content[0] as any;
        expect(last.type).toBe("tool_result");
        expect(JSON.parse(last.content).clicks).toBe(4800);
        return { content: [text("cmp_001 had 4800 clicks.")] };
      },
    ]);
    const r = await runAgent("How many clicks did cmp_001 get?", { provider: p, tools });
    expect(r.stop).toBe("final");
    expect(r.iterations).toBe(2);
    expect(r.toolCalls).toEqual([{ name: "get_campaign_report", input: { campaignId: "cmp_001" }, ok: true }]);
    expect(r.answer).toContain("4800");
  });

  it("stops at the iteration cap when the model never stops calling tools", async () => {
    const p = new FakeProvider([{ content: [toolUse("x", "list_campaigns", {})] }]);
    const r = await runAgent("loop forever", { provider: p, tools, limits: { maxIterations: 3 } });
    expect(r.stop).toBe("max_iterations");
    expect(p.calls).toBe(3);
  });

  it("stops when the token budget is exceeded", async () => {
    const p = new FakeProvider([{ content: [toolUse("x", "list_campaigns", {})], usage: { inputTokens: 600, outputTokens: 600 } }]);
    const r = await runAgent("spend", { provider: p, tools, limits: { maxTotalTokens: 1000, maxIterations: 10 } });
    expect(r.stop).toBe("budget_exceeded");
    expect(p.calls).toBe(1);
  });

  it("stops when the cost budget is exceeded", async () => {
    const p = new FakeProvider([{ content: [toolUse("x", "list_campaigns", {})], usage: { inputTokens: 1_000_000, outputTokens: 0 } }]);
    const r = await runAgent("cost", { provider: p, tools, limits: { maxCostUsd: 0.5 } });
    expect(r.stop).toBe("budget_exceeded");
  });

  it("feeds validation errors back to the model instead of executing", async () => {
    const p = new FakeProvider([
      { content: [toolUse("b", "get_campaign_report", { campaignId: "../etc/passwd" })] },
      { content: [text("done")] },
    ]);
    const r = await runAgent("bad id", { provider: p, tools });
    expect(r.toolCalls[0]?.ok).toBe(false);
    const fed = JSON.stringify(p.requests[1]!.messages);
    expect(fed).toContain("Invalid arguments");
  });

  it("rejects disallowed tools (allow-list) such as write operations", async () => {
    const p = new FakeProvider([{ content: [toolUse("c", "delete_campaign", { id: "cmp_001" })] }, { content: [text("ok")] }]);
    const r = await runAgent("delete it", { provider: p, tools });
    expect(r.toolCalls[0]?.ok).toBe(false);
    expect(JSON.stringify(p.requests[1]!.messages)).toContain("not allowed");
  });

  it("validates input and redacts PII-ish data from answers and logs", async () => {
    await expect(runAgent("   ", { provider: new FakeProvider([{ content: [text("x")] }]), tools })).rejects.toBeInstanceOf(GuardrailError);
    const lines: string[] = [];
    const p = new FakeProvider([{ content: [text("Contact jane.doe@example.com or 555-123-4567")] }]);
    const r = await runAgent("who?", { provider: p, tools, log: createLogger((l) => lines.push(l)) });
    expect(r.answer).not.toContain("jane.doe");
    expect(r.answer).toContain("[REDACTED_EMAIL]");
    expect(lines.join("\n")).not.toMatch(/@example\.com/);
  });

  it("treats hostile tool output as data (demo analyst still answers correctly)", async () => {
    const r = await runAgent("Which campaign has the best CTR?", { provider: new FakeProvider(demoAnalystScript("best ctr")), tools });
    expect(r.answer).toContain("Spring Sneakers Launch");
    expect(r.answer.toLowerCase()).not.toContain("system prompt");
    // The hostile campaign name did reach the model as tool data:
    expect(JSON.stringify(r)).not.toContain("jane.doe@example.com");
  });
});
