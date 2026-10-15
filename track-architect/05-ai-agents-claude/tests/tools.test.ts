import { describe, it, expect } from "vitest";
import { executeTool, toolSpecs, TOOLS } from "../src/tools/registry";
import { createDefaultToolContext } from "../src/runtime";

const ctx = createDefaultToolContext();

describe("tool argument validation", () => {
  it("rejects wrong types, unknown keys and missing args", async () => {
    expect((await executeTool("list_campaigns", { status: "DELETED" }, ctx)).isError).toBe(true);
    expect((await executeTool("list_campaigns", { pageSize: 1000 }, ctx)).isError).toBe(true);
    expect((await executeTool("list_campaigns", { evil: 1 }, ctx)).isError).toBe(true);
    expect((await executeTool("get_campaign_report", {}, ctx)).isError).toBe(true);
    expect((await executeTool("search_playbook", { query: "x" }, ctx)).isError).toBe(true);
  });
  it("accepts valid args and surfaces API problems as errors", async () => {
    const ok = await executeTool("list_campaigns", { status: "ACTIVE" }, ctx);
    expect(ok.isError).toBe(false);
    const nf = await executeTool("get_campaign_report", { campaignId: "nope" }, ctx);
    expect(nf.isError).toBe(true);
    expect(nf.content).toContain("404");
  });
  it("exposes JSON schemas and only read-only tools", () => {
    expect(toolSpecs().map((t) => t.name)).toEqual(["list_campaigns", "get_campaign_report", "search_playbook"]);
    expect(TOOLS.every((t) => t.readOnly)).toBe(true);
    expect((toolSpecs()[1]!.inputSchema as any).required).toContain("campaignId");
  });
});
