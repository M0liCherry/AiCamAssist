import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { chapters, chunks, notes, subjects } from "@/db/schema";
import { embedTexts, type ProviderConfig } from "@/lib/ai/provider";
import type { Scope } from "@/lib/http";

const STOPWORDS = new Set(
  "the and for that with this are was from have what which how why when where who does into about can you your its their they than then there these those also but not all any our one two use used using will would should could may might been being has had were his her him she of to in on at by an a is it or as be if do we i so no up out more most such over under per each between within".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function hardSplit(text: string, size: number) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Paragraph- and sentence-aware chunking with light overlap for retrieval. */
export function chunkText(text: string, size = 1100, overlap = 160): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const out: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) out.push(current.trim());
  };
  for (const paragraph of clean.split(/\n{2,}/)) {
    const units = paragraph.length > size ? paragraph.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [paragraph] : [paragraph];
    for (const unit of units) {
      const joiner = current ? (paragraph.length > size ? " " : "\n\n") : "";
      if ((current + joiner + unit).length > size && current) {
        push();
        current = `${current.slice(-overlap)} ${unit}`;
      } else {
        current += joiner + unit;
      }
    }
  }
  push();
  return out.flatMap((chunk) => (chunk.length > size * 1.6 ? hardSplit(chunk, size) : [chunk])).filter((chunk) => chunk.length > 20);
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export const embeddingModelId = (provider: string, model: string) => `${provider}:${model}`;

/** (Re)builds the retrieval index for one note. Returns the resulting index state. */
export async function indexNote(
  db: Database,
  cfg: ProviderConfig,
  note: { id: number; chapterId: number; content: string },
  subjectId: number,
): Promise<"embedded" | "lexical" | "none"> {
  await db.delete(chunks).where(eq(chunks.noteId, note.id));
  const pieces = chunkText(note.content);
  if (!pieces.length) return "none";
  const embedded = cfg.provider !== "none" ? await embedTexts(cfg, pieces, "document") : null;
  const modelId = embedded ? embeddingModelId(cfg.provider, embedded.model) : null;
  const rows = pieces.map((content, position) => ({
    noteId: note.id,
    chapterId: note.chapterId,
    subjectId,
    position,
    content,
    embedding: embedded ? embedded.vectors[position] : null,
    embeddingModel: modelId,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(chunks).values(rows.slice(i, i + 200));
  }
  return embedded ? "embedded" : "lexical";
}

export type ScopeNotes = { title: string; subjectId: number; notes: { id: number; title: string; content: string; chapterId: number }[] };

/** Loads every note inside a chapter, or across all chapters of a subject. */
export async function loadScope(db: Database, scope: Scope): Promise<ScopeNotes | null> {
  if (scope.scopeType === "chapter") {
    const [chapter] = await db
      .select({ id: chapters.id, name: chapters.name, subjectId: chapters.subjectId, subjectName: subjects.name })
      .from(chapters)
      .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
      .where(eq(chapters.id, scope.scopeId));
    if (!chapter) return null;
    const rows = await db
      .select({ id: notes.id, title: notes.title, content: notes.content, chapterId: notes.chapterId })
      .from(notes)
      .where(eq(notes.chapterId, chapter.id))
      .orderBy(asc(notes.createdAt));
    return { title: `${chapter.subjectName} › ${chapter.name}`, subjectId: chapter.subjectId, notes: rows };
  }
  const [subject] = await db.select().from(subjects).where(eq(subjects.id, scope.scopeId));
  if (!subject) return null;
  const rows = await db
    .select({ id: notes.id, title: notes.title, content: notes.content, chapterId: notes.chapterId })
    .from(notes)
    .innerJoin(chapters, eq(chapters.id, notes.chapterId))
    .where(eq(chapters.subjectId, subject.id))
    .orderBy(asc(chapters.position), asc(notes.createdAt));
  return { title: `${subject.name} (entire subject)`, subjectId: subject.id, notes: rows };
}

export type RetrievedChunk = { n: number; noteId: number; noteTitle: string; chunkId: number; content: string; score: number };

/**
 * Hybrid retrieval: BM25-style keyword ranking fused with cosine similarity
 * when embeddings from the active model exist. Diversifies across notes.
 */
export async function retrieveContext(
  db: Database,
  cfg: ProviderConfig,
  scope: Scope,
  query: string,
  options: { noteIds?: number[]; limit?: number } = {},
): Promise<RetrievedChunk[]> {
  const limit = options.limit ?? 6;
  const scopeCondition = scope.scopeType === "chapter" ? eq(chunks.chapterId, scope.scopeId) : eq(chunks.subjectId, scope.scopeId);
  const where = options.noteIds?.length ? and(scopeCondition, inArray(chunks.noteId, options.noteIds)) : scopeCondition;
  const rows = await db
    .select({ id: chunks.id, noteId: chunks.noteId, content: chunks.content, embedding: chunks.embedding, embeddingModel: chunks.embeddingModel, noteTitle: notes.title })
    .from(chunks)
    .innerJoin(notes, eq(notes.id, chunks.noteId))
    .where(where);
  if (!rows.length) return [];

  const queryTokens = tokenize(query);
  const documentFrequency = new Map<string, number>();
  const docTokens = rows.map((row) => {
    const tokens = tokenize(row.content);
    new Set(tokens).forEach((token) => documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1));
    return tokens;
  });
  const total = rows.length;
  const lexical = docTokens.map((tokens) => {
    if (!tokens.length || !queryTokens.length) return 0;
    const counts = new Map<string, number>();
    tokens.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
    let score = 0;
    for (const term of queryTokens) {
      const tf = counts.get(term);
      if (!tf) continue;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      score += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (tokens.length / 220))));
    }
    return score;
  });

  let semantic: number[] | null = null;
  if (cfg.provider !== "none" && rows.some((row) => row.embedding && row.embeddingModel)) {
    const embedded = await embedTexts(cfg, [query], "query");
    if (embedded?.vectors[0]) {
      const modelId = embeddingModelId(cfg.provider, embedded.model);
      const queryVector = embedded.vectors[0];
      semantic = rows.map((row) => (row.embedding && row.embeddingModel === modelId ? cosine(queryVector, row.embedding) : 0));
      if (!semantic.some((value) => value > 0)) semantic = null;
    }
  }

  const maxLexical = Math.max(...lexical, 1e-9);
  const maxSemantic = semantic ? Math.max(...semantic, 1e-9) : 1;
  const scored = rows
    .map((row, index) => {
      const lex = lexical[index] / maxLexical;
      const sem = semantic ? Math.max(0, semantic[index]) / maxSemantic : 0;
      return { row, score: semantic ? 0.65 * sem + 0.35 * lex : lex };
    })
    .filter((item) => item.score > 0.02)
    .sort((a, b) => b.score - a.score);

  const perNote = new Map<number, number>();
  const picked: typeof scored = [];
  for (const item of scored) {
    const used = perNote.get(item.row.noteId) ?? 0;
    if (used >= 3) continue;
    perNote.set(item.row.noteId, used + 1);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  if (!picked.length) picked.push(...rows.slice(0, limit).map((row) => ({ row, score: 0 })));

  return picked.map((item, index) => ({
    n: index + 1,
    noteId: item.row.noteId,
    noteTitle: item.row.noteTitle,
    chunkId: item.row.id,
    content: item.row.content,
    score: Number(item.score.toFixed(3)),
  }));
}
