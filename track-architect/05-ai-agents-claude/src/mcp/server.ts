import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS, executeTool, type ToolContext } from "../tools/registry";
import { createDefaultToolContext } from "../runtime";

/**
 * Exposes the SAME read-only tools (same zod schemas, same allow-list/validation path)
 * to any MCP client over stdio.
 */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "adflow-ads-analyst", version: "0.1.0" });
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.shape, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (args: unknown) => {
        const out = await executeTool(t.name, args, ctx);
        return { content: [{ type: "text" as const, text: out.content }], isError: out.isError };
      },
    );
  }
  return server;
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const server = createMcpServer(createDefaultToolContext());
  await server.connect(new StdioServerTransport());
  console.error("adflow-ads-analyst MCP server running on stdio"); // stderr: stdout is the protocol channel
}
