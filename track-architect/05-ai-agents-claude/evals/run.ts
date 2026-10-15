import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runEvals, type EvalCase } from "./harness";
import { createDefaultToolContext } from "../src/runtime";
import { pickProvider } from "../src/providers/select";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const pi = argv.indexOf("--provider");
const choice = pi >= 0 ? argv[pi + 1] : process.env.ANTHROPIC_API_KEY ? "anthropic" : "fake";
const threshold = Number(process.env.EVAL_MIN_PASS_RATE ?? (choice === "fake" ? 1 : 0.75));

if (choice === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set; refusing to run live evals.");
  process.exit(2);
}

const cases: EvalCase[] = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8"));
const report = await runEvals(cases, (c) => pickProvider(c.question, choice), createDefaultToolContext());

console.log(`Provider: ${report.provider} (${report.model})`);
for (const c of report.cases)
  console.log(`${c.pass ? "PASS" : "FAIL"} ${c.id.padEnd(22)} ${String(c.tokens).padStart(6)} tok  ${String(c.latencyMs).padStart(5)} ms  ~$${c.costUsd.toFixed(4)}${c.pass ? "" : "  <- " + c.failures.join("; ")}`);
console.log(
  `Pass rate: ${(report.passRate * 100).toFixed(0)}% (${report.passed}/${report.total}) | tokens: ${report.totalTokens} | ` +
    `avg latency: ${report.avgLatencyMs.toFixed(0)} ms | est. cost: $${report.totalCostUsd.toFixed(4)}` +
    (choice === "fake" ? "  (fake provider: tokens/cost are char-based approximations)" : ""),
);
process.exit(report.passRate >= threshold ? 0 : 1);
