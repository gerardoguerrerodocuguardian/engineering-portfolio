import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Chunk {
  id: string;
  source: string;
  heading: string;
  text: string;
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

/** Pluggable retrieval port. Swap BM25 for pgvector / Bedrock Knowledge Bases behind this. */
export interface Retriever {
  search(query: string, k?: number): Promise<Hit[]>;
}

/** Pluggable embedding port (used by VectorRetriever). */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

/** Split markdown files in a folder into chunks, one per "##" section (with the "#" title as context). */
export function loadMarkdownChunks(dir: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const raw = readFileSync(path.join(dir, file), "utf8");
    const title = /^#\s+(.+)$/m.exec(raw)?.[1] ?? file;
    const sections = raw.split(/^##\s+/m).slice(1);
    sections.forEach((sec, i) => {
      const [headingLine, ...rest] = sec.split("\n");
      chunks.push({
        id: `${file}#${i}`,
        source: file,
        heading: `${title} / ${(headingLine ?? "").trim()}`,
        text: rest.join("\n").trim(),
      });
    });
  }
  return chunks;
}

const STOP = new Set("a an the and or of to in is are was for on with it as at by be this that from how what which my i do does".split(" "));

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/** Dependency-free BM25 over chunks. Good enough for a small curated corpus. */
export class Bm25Retriever implements Retriever {
  private readonly docs: { chunk: Chunk; tf: Map<string, number>; len: number }[];
  private readonly df = new Map<string, number>();
  private readonly avgLen: number;

  constructor(chunks: Chunk[], private readonly k1 = 1.5, private readonly b = 0.75) {
    this.docs = chunks.map((chunk) => {
      const toks = tokenize(`${chunk.heading} ${chunk.heading} ${chunk.text}`);
      const tf = new Map<string, number>();
      toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
      return { chunk, tf, len: toks.length };
    });
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / Math.max(1, this.docs.length);
  }

  async search(query: string, k = 3): Promise<Hit[]> {
    const q = tokenize(query);
    const N = this.docs.length;
    const hits: Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen)));
      }
      if (score > 0) hits.push({ chunk: d.chunk, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

/**
 * In-memory dense retriever over any Embedder (cosine similarity). Shows the seam where
 * Bedrock Titan/Cohere embeddings + pgvector would plug in. Not used by default.
 */
export class VectorRetriever implements Retriever {
  private vectors: number[][] = [];
  private constructor(private readonly chunks: Chunk[], private readonly embedder: Embedder) {}

  static async create(chunks: Chunk[], embedder: Embedder): Promise<VectorRetriever> {
    const r = new VectorRetriever(chunks, embedder);
    r.vectors = await embedder.embed(chunks.map((c) => `${c.heading}\n${c.text}`));
    return r;
  }

  async search(query: string, k = 3): Promise<Hit[]> {
    const [qv] = await this.embedder.embed([query]);
    if (!qv) return [];
    return this.chunks
      .map((chunk, i) => ({ chunk, score: cosine(qv, this.vectors[i] ?? []) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
