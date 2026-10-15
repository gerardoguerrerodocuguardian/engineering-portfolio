import path from "node:path";
import { fileURLToPath } from "node:url";
import { MockCampaignApi } from "./data/mockCampaignApi";
import { Bm25Retriever, loadMarkdownChunks } from "./rag/retriever";
import type { ToolContext } from "./tools/registry";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PLAYBOOK_DIR = path.resolve(here, "../docs/playbook");

/** Default wiring: in-process mock API + local BM25 retriever. Swap either behind its interface. */
export function createDefaultToolContext(): ToolContext {
  return {
    api: new MockCampaignApi(),
    retriever: new Bm25Retriever(loadMarkdownChunks(PLAYBOOK_DIR)),
  };
}
