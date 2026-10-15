import { runAgent } from "./agent/loop";
import { createDefaultToolContext } from "./runtime";
import { pickProvider } from "./providers/select";
import { createLogger } from "./guardrails/redact";

async function main() {
  const args = process.argv.slice(2);
  const pi = args.indexOf("--provider");
  const choice = pi >= 0 ? args.splice(pi, 2)[1] : undefined;
  const verbose = args.includes("--verbose");
  const question = args.filter((a) => a !== "--verbose").join(" ");
  if (!question) {
    console.error('Usage: npm run ask -- [--provider fake|anthropic] [--verbose] "your question"');
    process.exit(2);
  }
  const provider = pickProvider(question, choice);
  console.error(`[provider=${provider.name} model=${provider.model}]`);
  const log = createLogger((line) => verbose && console.error(line));
  const r = await runAgent(question, { provider, tools: createDefaultToolContext(), log });
  console.log(r.answer);
  console.error(
    `[stop=${r.stop} iterations=${r.iterations} tools=${r.toolCalls.map((t) => t.name).join(",")} ` +
      `tokens=${r.usage.inputTokens}in/${r.usage.outputTokens}out cost~$${r.costUsd.toFixed(4)} ${r.latencyMs}ms]`,
  );
}

main().catch((e) => {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
});
