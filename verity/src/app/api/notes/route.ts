import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, type Database } from "@/db";
import { chapters, notes, subjects } from "@/db/schema";
import { summarizeNote } from "@/lib/ai/generate";
import { cleanText, fail, HttpError, ok, parseScope, readJson, requireInt } from "@/lib/http";
import { countWords } from "@/lib/ingest";
import { indexNote } from "@/lib/rag";
import { getProviderConfig, requireProvider } from "@/lib/settings";

export const dynamic = "force-dynamic";

const listColumns = {
  id: notes.id,
  chapterId: notes.chapterId,
  title: notes.title,
  sourceType: notes.sourceType,
  sourceLabel: notes.sourceLabel,
  status: notes.status,
  indexState: notes.indexState,
  errorMessage: notes.errorMessage,
  wordCount: notes.wordCount,
  hasSummary: sql<boolean>`(${notes.summary} is not null)`,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
};

async function subjectIdForChapter(db: Database, chapterId: number) {
  const [chapter] = await db.select({ subjectId: chapters.subjectId }).from(chapters).where(eq(chapters.id, chapterId));
  if (!chapter) throw new HttpError("Chapter not found.", 404);
  return chapter.subjectId;
}

async function reindex(db: Database, noteId: number) {
  const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!note) throw new HttpError("Note not found.", 404);
  const subjectId = await subjectIdForChapter(db, note.chapterId);
  const cfg = await getProviderConfig();
  try {
    const indexState = await indexNote(db, cfg, note, subjectId);
    await db.update(notes).set({ indexState, status: "ready", errorMessage: null }).where(eq(notes.id, noteId));
  } catch (error) {
    await db.update(notes).set({ indexState: "lexical", status: "ready", errorMessage: error instanceof Error ? error.message : "Indexing failed" }).where(eq(notes.id, noteId));
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const params = request.nextUrl.searchParams;

    if (params.get("id")) {
      const id = requireInt(params.get("id"), "Note id");
      const [note] = await db
        .select({ note: notes, chapterName: chapters.name, subjectName: subjects.name, subjectId: subjects.id })
        .from(notes)
        .innerJoin(chapters, eq(chapters.id, notes.chapterId))
        .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
        .where(eq(notes.id, id));
      if (!note) throw new HttpError("Note not found.", 404);
      return ok({ note: { ...note.note, chapterName: note.chapterName, subjectName: note.subjectName, subjectId: note.subjectId } });
    }

    const query = cleanText(params.get("q"), 200);
    if (query) {
      const pattern = `%${query.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      const rows = await db
        .select({ id: notes.id, title: notes.title, content: notes.content, sourceType: notes.sourceType, chapterId: chapters.id, chapterName: chapters.name, subjectId: subjects.id, subjectName: subjects.name })
        .from(notes)
        .innerJoin(chapters, eq(chapters.id, notes.chapterId))
        .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
        .where(or(ilike(notes.title, pattern), ilike(notes.content, pattern)))
        .orderBy(desc(notes.updatedAt))
        .limit(30);
      const lower = query.toLowerCase();
      const results = rows.map((row) => {
        const index = row.content.toLowerCase().indexOf(lower);
        const start = Math.max(0, index - 80);
        const snippet = index === -1 ? row.content.slice(0, 160) : `${start > 0 ? "…" : ""}${row.content.slice(start, index + query.length + 80)}…`;
        return { id: row.id, title: row.title, snippet: snippet.replace(/\s+/g, " "), sourceType: row.sourceType, chapterId: row.chapterId, chapterName: row.chapterName, subjectId: row.subjectId, subjectName: row.subjectName };
      });
      return ok({ results });
    }

    const scope = parseScope(params.get("scopeType"), params.get("scopeId"));
    const rows =
      scope.scopeType === "chapter"
        ? await db.select(listColumns).from(notes).where(eq(notes.chapterId, scope.scopeId)).orderBy(desc(notes.updatedAt))
        : await db.select(listColumns).from(notes).innerJoin(chapters, eq(chapters.id, notes.chapterId)).where(eq(chapters.subjectId, scope.scopeId)).orderBy(desc(notes.updatedAt));
    return ok({ notes: rows });
  } catch (error) {
    return fail(error, "Notes could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const db = await getDb();

    if (body.action === "summarize") {
      const noteId = requireInt(body.noteId, "Note id");
      const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
      if (!note) throw new HttpError("Note not found.", 404);
      if (!note.content.trim()) throw new HttpError("This note is empty; add content before summarizing.");
      const cfg = requireProvider(await getProviderConfig());
      const personalization = typeof body.personalization === "string" ? cleanText(body.personalization, 1500) || undefined : undefined;
      const summary = await summarizeNote(cfg, note.title, note.content.slice(0, 60_000), personalization);
      const [updated] = await db.update(notes).set({ summary, updatedAt: new Date() }).where(eq(notes.id, noteId)).returning();
      return ok({ note: updated });
    }

    if (body.action === "reindex") {
      if (body.noteId) {
        await reindex(db, requireInt(body.noteId, "Note id"));
        return ok({ reindexed: 1 });
      }
      const all = await db.select({ id: notes.id }).from(notes);
      for (const row of all) await reindex(db, row.id);
      return ok({ reindexed: all.length });
    }

    const chapterId = requireInt(body.chapterId, "Chapter");
    const subjectId = await subjectIdForChapter(db, chapterId);
    const title = cleanText(body.title, 300) || "Untitled note";
    const content = typeof body.content === "string" ? body.content.slice(0, 1_500_000) : "";
    const [note] = await db
      .insert(notes)
      .values({ chapterId, title, content, sourceType: "blank", wordCount: countWords(content), status: "ready", indexState: "none" })
      .returning();
    if (content.trim()) {
      const cfg = await getProviderConfig();
      const indexState = await indexNote(db, cfg, note, subjectId).catch(() => "lexical" as const);
      await db.update(notes).set({ indexState }).where(eq(notes.id, note.id));
      note.indexState = indexState;
    }
    return ok({ note }, 201);
  } catch (error) {
    return fail(error, "The note could not be created.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readJson(request);
    const db = await getDb();
    const id = requireInt(body.id, "Note id");
    const [existing] = await db.select().from(notes).where(eq(notes.id, id));
    if (!existing) throw new HttpError("Note not found.", 404);

    const patch: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      patch.title = cleanText(body.title, 300);
      if (!patch.title) throw new HttpError("A title is required.");
    }
    let contentChanged = false;
    if (typeof body.content === "string") {
      patch.content = body.content.slice(0, 1_500_000);
      patch.wordCount = countWords(patch.content);
      contentChanged = patch.content !== existing.content;
      if (contentChanged) patch.summary = null;
    }
    let subjectId: number | null = null;
    if (body.chapterId !== undefined && Number(body.chapterId) !== existing.chapterId) {
      patch.chapterId = requireInt(body.chapterId, "Chapter");
      subjectId = await subjectIdForChapter(db, patch.chapterId);
    }
    const [updated] = await db.update(notes).set(patch).where(eq(notes.id, id)).returning();
    if (!updated) throw new HttpError("The note could not be found.", 404);

    if (contentChanged || subjectId !== null) {
      const cfg = await getProviderConfig();
      const targetSubject = subjectId ?? (await subjectIdForChapter(db, updated.chapterId));
      const indexState = await indexNote(db, cfg, updated, targetSubject).catch(() => "lexical" as const);
      await db.update(notes).set({ indexState }).where(eq(notes.id, id));
      updated.indexState = indexState;
    }
    return ok({ note: updated });
  } catch (error) {
    return fail(error, "The note could not be saved.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = requireInt(request.nextUrl.searchParams.get("id"), "Note id");
    const db = await getDb();
    const [deleted] = await db.delete(notes).where(and(eq(notes.id, id))).returning();
    if (!deleted) throw new HttpError("The note could not be found.", 404);
    return ok({ ok: true });
  } catch (error) {
    return fail(error, "The note could not be deleted.");
  }
}
