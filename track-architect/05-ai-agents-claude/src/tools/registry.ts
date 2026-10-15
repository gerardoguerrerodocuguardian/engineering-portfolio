import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { CampaignApi } from "../data/mockCampaignApi";
import { ApiError } from "../data/mockCampaignApi";
import type { Retriever } from "../rag/retriever";
import { redact } from "../guardrails/redact";
import type { ToolSpec } from "../types";

export interface ToolContext {
  api: CampaignApi;
  retriever: Retriever;
}

/** Every tool is read-only by construction: the CampaignApi port exposes no write methods. */
export interface ToolDef {
  name: string;
  description: string;
  shape: z.ZodRawShape;
  readOnly: true;
  run(args: any, ctx: ToolContext): Promise<unknown>;
}

const status = z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXHAUSTED"]);

export const TOOLS: ToolDef[] = [
  {
    name: "list_campaigns",
    description:
      "List AdFlow campaigns (id, name, status, budgets, keywords). Optionally filter by status. Read-only.",
    shape: {
      status: status.optional().describe("Filter by campaign status"),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    },
    readOnly: true,
    run: (a, ctx) => ctx.api.listCampaigns(a),
  },
  {
    name: "get_campaign_report",
    description:
      "Get the aggregated performance report for one campaign: impressions, clicks, spendCents, ctr (clicks/impressions). Read-only.",
    shape: { campaignId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "invalid campaign id") },
    readOnly: true,
    run: (a, ctx) => ctx.api.getCampaignReport(a.campaignId),
  },
  {
    name: "search_playbook",
    description:
      "Search the internal ad best-practice playbook (RAG). Use for advice on improving CTR, pacing, bidding, targeting.",
    shape: { query: z.string().min(2).max(300), k: z.number().int().min(1).max(5).optional() },
    readOnly: true,
    run: async (a, ctx) =>
      (await ctx.retriever.search(a.query, a.k ?? 3)).map((h) => ({
        source: h.chunk.source,
        section: h.chunk.heading,
        score: Number(h.score.toFixed(3)),
        text: h.chunk.text,
      })),
  },
];

export const ALLOWED_TOOLS: ReadonlySet<string> = new Set(TOOLS.map((t) => t.name));

const strictSchema = (t: ToolDef) => z.object(t.shape).strict();

export function toolSpecs(): ToolSpec[] {
  return TOOLS.map((t) => {
    const { $schema, ...inputSchema } = zodToJson(strictSchema(t));
    void $schema;
    return { name: t.name, description: t.description, inputSchema };
  });
}

function zodToJson(s: z.ZodTypeAny): Record<string, any> {
  return zodToJsonSchema(s, { target: "jsonSchema7", $refStrategy: "none" }) as Record<string, any>;
}

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

const MAX_TOOL_RESULT_CHARS = 6000;

/**
 * Execute a model-requested tool call: allow-list check, zod validation, run, size cap.
 * Output is returned to the model as untrusted DATA (see agent system prompt).
 */
export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  if (!ALLOWED_TOOLS.has(name)) return { content: `Tool "${name}" is not allowed.`, isError: true };
  const tool = TOOLS.find((t) => t.name === name)!;
  const parsed = strictSchema(tool).safeParse(input ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { content: `Invalid arguments for ${name}: ${msg}`, isError: true };
  }
  try {
    const result = await tool.run(parsed.data, ctx);
    let json = JSON.stringify(result);
    if (json.length > MAX_TOOL_RESULT_CHARS) json = json.slice(0, MAX_TOOL_RESULT_CHARS) + '..."[truncated]"';
    return { content: json, isError: false };
  } catch (e) {
    if (e instanceof ApiError) return { content: JSON.stringify(e.problem), isError: true };
    return { content: redact(`Tool ${name} failed: ${(e as Error).message}`), isError: true };
  }
}
