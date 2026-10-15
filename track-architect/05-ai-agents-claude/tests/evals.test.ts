import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runEvals, type EvalCase } from "../evals/harness";
import { FakeProvider, demoAnalystScript, text } from "../src/providers/fake";
import { createDefaultToolContext } from "../src/runtime";

const cases: EvalCase[] = JSON.parse(readFileSync(new URL("../evals/cases.json", import.meta.url), "utf8"));

describe("eval harness", () => {
  it("passes all golden cases with the scripted fake analyst", async () => {
    const rep = await runEvals(cases, (c) => new FakeProvider(demoAnalystScript(c.question)), createDefaultToolContext());
    expect(rep.cases.filter((c) => !c.pass)).toEqual([]);
    expect(rep.passRate).toBe(1);
    expect(rep.totalTokens).toBeGreaterThan(0);
    expect(rep.totalCostUsd).toBeGreaterThan(0);
  });
  it("detects failures (a model that never calls tools)", async () => {
    const rep = await runEvals(cases, () => new FakeProvider([{ content: [text("I guess campaign X.")] }]), createDefaultToolContext());
    expect(rep.passRate).toBeLessThan(1);
    expect(rep.cases[0]!.failures.join()).toContain("missing tool call");
  });
});
