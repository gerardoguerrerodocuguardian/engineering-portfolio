import type { Usage } from "../types";

export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

/**
 * Estimates only. Defaults mirror published list prices for claude-sonnet-5-5 at the time of writing
 * ($2 in / $10 out, cache read 10% of input, cache write assumed 1.25x input). Verify before relying
 * on them and override via env for other models.
 */
export function pricingFromEnv(env = process.env): Pricing {
  const input = Number(env.PRICE_INPUT_PER_MTOK ?? 2);
  return {
    inputPerMTok: input,
    outputPerMTok: Number(env.PRICE_OUTPUT_PER_MTOK ?? 10),
    cacheReadPerMTok: input * 0.1,
    cacheWritePerMTok: input * 1.25,
  };
}

export function estimateCostUsd(u: Usage, p: Pricing): number {
  return (
    (u.inputTokens * p.inputPerMTok + u.outputTokens * p.outputPerMTok +
      u.cacheReadTokens * p.cacheReadPerMTok + u.cacheWriteTokens * p.cacheWritePerMTok) / 1_000_000
  );
}
