import { AnthropicProvider } from "./anthropic";
import { FakeProvider, demoAnalystScript } from "./fake";
import type { LlmProvider } from "../types";

/** "anthropic" needs ANTHROPIC_API_KEY (env). Default: live if a key is present, else the offline fake. */
export function pickProvider(question: string, choice?: string): LlmProvider {
  const kind = choice ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "fake");
  if (kind === "anthropic") return new AnthropicProvider();
  return new FakeProvider(demoAnalystScript(question));
}
