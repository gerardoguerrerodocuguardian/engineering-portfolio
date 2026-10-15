import { describe, it, expect } from "vitest";
import { Bm25Retriever, VectorRetriever, loadMarkdownChunks } from "../src/rag/retriever";
import { PLAYBOOK_DIR } from "../src/runtime";

const chunks = loadMarkdownChunks(PLAYBOOK_DIR);

describe("BM25 retriever", () => {
  const r = new Bm25Retriever(chunks);
  it("loads chunks from markdown", () => expect(chunks.length).toBeGreaterThan(8));
  it("ranks the relevant section first", async () => {
    expect((await r.search("campaign exhausted budget too early", 3))[0]!.chunk.source).toBe("budget-pacing.md");
    expect((await r.search("improve click-through rate headline creative", 3))[0]!.chunk.source).toBe("ctr-optimization.md");
    expect((await r.search("max bid cost per click", 3))[0]!.chunk.source).toBe("bidding-strategy.md");
  });
  it("returns nothing for unrelated queries and sorts by score", async () => {
    expect(await r.search("zzzz qqqq")).toEqual([]);
    const hits = await r.search("ctr bid budget", 5);
    for (let i = 1; i < hits.length; i++) expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
  });
});

describe("pluggable vector retriever", () => {
  it("works with any Embedder", async () => {
    const vocab = ["budget", "bid", "ctr"];
    const embedder = { embed: async (ts: string[]) => ts.map((t) => vocab.map((w) => (t.toLowerCase().includes(w) ? 1 : 0))) };
    const v = await VectorRetriever.create(chunks, embedder);
    expect((await v.search("budget", 1)).length).toBe(1);
  });
});
