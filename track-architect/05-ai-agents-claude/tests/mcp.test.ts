import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server";
import { createDefaultToolContext } from "../src/runtime";

async function connect() {
  const server = createMcpServer(createDefaultToolContext());
  const client = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe("MCP server", () => {
  it("lists the same three read-only tools", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_campaign_report", "list_campaigns", "search_playbook"]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });
  it("calls a tool and returns validation errors as isError", async () => {
    const c = await connect();
    const ok: any = await c.callTool({ name: "get_campaign_report", arguments: { campaignId: "cmp_002" } });
    expect(JSON.parse(ok.content[0].text).clicks).toBe(2250);
    const bad: any = await c.callTool({ name: "get_campaign_report", arguments: { campaignId: "bad id!" } });
    expect(bad.isError).toBe(true);
  });
});
