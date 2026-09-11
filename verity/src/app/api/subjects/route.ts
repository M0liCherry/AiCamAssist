import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, type Database } from "@/db";
import { chapters, chatMessages, chunks, flashcardProgress, generatedAssets, notes, quizAttempts, subjects } from "@/db/schema";
import { cleanText, fail, HttpError, ok, readJson, requireInt } from "@/lib/http";

export const dynamic = "force-dynamic";

async function loadTree(db: Database) {
  const subjectRows = await db.select().from(subjects).orderBy(asc(subjects.position), asc(subjects.id));
  const chapterRows = await db.select().from(chapters).orderBy(asc(chapters.position), asc(chapters.id));
  const counts = await db.select({ chapterId: notes.chapterId, total: count() }).from(notes).groupBy(notes.chapterId);
  const countMap = new Map(counts.map((row) => [row.chapterId, Number(row.total)]));

  // Load flashcard metrics
  const fcAssets = await db
    .select({
      id: generatedAssets.id,
      scopeType: generatedAssets.scopeType,
      scopeId: generatedAssets.scopeId,
    })
    .from(generatedAssets)
    .where(eq(generatedAssets.kind, "flashcards"))
    .orderBy(desc(generatedAssets.id));

  const latestFcAssetByScope = new Map<string, number>();
  for (const row of fcAssets) {
    const key = `${row.scopeType}:${row.scopeId}`;
    if (!latestFcAssetByScope.has(key)) latestFcAssetByScope.set(key, row.id);
  }

  const fcAssetIds = Array.from(latestFcAssetByScope.values());
  const fcProgressRows = fcAssetIds.length > 0
    ? await db.select().from(flashcardProgress).where(inArray(flashcardProgress.assetId, fcAssetIds))
    : [];

  const fcMetricsByAsset = new Map<number, { mastered: number; learning: number; newCount: number; total: number }>();
  for (const p of fcProgressRows) {
    const cur = fcMetricsByAsset.get(p.assetId) ?? { mastered: 0, learning: 0, newCount: 0, total: 0 };
    cur.total += 1;
    if (p.status === "mastered") cur.mastered += 1;
    else if (p.status === "learning") cur.learning += 1;
    else cur.newCount += 1;
    fcMetricsByAsset.set(p.assetId, cur);
  }

  // Load quiz metrics
  const quizAssets = await db
    .select({
      id: generatedAssets.id,
      scopeType: generatedAssets.scopeType,
      scopeId: generatedAssets.scopeId,
    })
    .from(generatedAssets)
    .where(eq(generatedAssets.kind, "quiz"));

  const quizAssetScopeMap = new Map<number, string>();
  const quizAssetIds: number[] = [];
  for (const q of quizAssets) {
    quizAssetScopeMap.set(q.id, `${q.scopeType}:${q.scopeId}`);
    quizAssetIds.push(q.id);
  }

  const quizAttemptsRows = quizAssetIds.length > 0
    ? await db.select().from(quizAttempts).where(inArray(quizAttempts.assetId, quizAssetIds))
    : [];

  const quizMetricsByScope = new Map<string, { bestScore: number; total: number; percentage: number; attemptsCount: number }>();
  for (const att of quizAttemptsRows) {
    const scopeKey = quizAssetScopeMap.get(att.assetId);
    if (!scopeKey) continue;
    const existing = quizMetricsByScope.get(scopeKey);
    const pct = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
    if (!existing) {
      quizMetricsByScope.set(scopeKey, { bestScore: att.score, total: att.total, percentage: pct, attemptsCount: 1 });
    } else {
      existing.attemptsCount += 1;
      if (att.score > existing.bestScore || (att.score === existing.bestScore && att.total > existing.total)) {
        existing.bestScore = att.score;
        existing.total = att.total;
        existing.percentage = pct;
      }
    }
  }

  return subjectRows.map((subject) => {
    const list = chapterRows
      .filter((chapter) => chapter.subjectId === subject.id)
      .map((chapter) => {
        const fcAssetId = latestFcAssetByScope.get(`chapter:${chapter.id}`);
        const fcData = fcAssetId ? fcMetricsByAsset.get(fcAssetId) : undefined;
        const quizData = quizMetricsByScope.get(`chapter:${chapter.id}`);

        const flashcards = fcData && fcData.total > 0
          ? {
              mastered: fcData.mastered,
              learning: fcData.learning,
              newCount: fcData.newCount,
              total: fcData.total,
              score: fcData.mastered * 2 + fcData.learning * 1,
              maxScore: fcData.total * 2,
              percentage: Math.round(((fcData.mastered * 2 + fcData.learning * 1) / (fcData.total * 2)) * 100),
              summary: `${fcData.mastered}/${fcData.total} Mastered`,
            }
          : undefined;

        return {
          ...chapter,
          noteCount: countMap.get(chapter.id) ?? 0,
          studyMetrics: {
            flashcards,
            quiz: quizData,
          },
        };
      });

    // Aggregate subject study metrics across chapters and direct subject assets
    let subjectFcMastered = 0;
    let subjectFcTotal = 0;
    let subjectFcScore = 0;
    let subjectFcMaxScore = 0;

    const directSubjectFcAssetId = latestFcAssetByScope.get(`subject:${subject.id}`);
    const directSubjectFcData = directSubjectFcAssetId ? fcMetricsByAsset.get(directSubjectFcAssetId) : undefined;
    if (directSubjectFcData) {
      subjectFcMastered += directSubjectFcData.mastered;
      subjectFcTotal += directSubjectFcData.total;
      subjectFcScore += directSubjectFcData.mastered * 2 + directSubjectFcData.learning * 1;
      subjectFcMaxScore += directSubjectFcData.total * 2;
    }

    for (const ch of list) {
      if (ch.studyMetrics?.flashcards) {
        subjectFcMastered += ch.studyMetrics.flashcards.mastered;
        subjectFcTotal += ch.studyMetrics.flashcards.total;
        subjectFcScore += ch.studyMetrics.flashcards.score;
        subjectFcMaxScore += ch.studyMetrics.flashcards.maxScore;
      }
    }

    let subjectQuizBest = 0;
    let subjectQuizTotal = 0;
    let subjectQuizAttempts = 0;

    const directSubjectQuiz = quizMetricsByScope.get(`subject:${subject.id}`);
    if (directSubjectQuiz) {
      subjectQuizBest += directSubjectQuiz.bestScore;
      subjectQuizTotal += directSubjectQuiz.total;
      subjectQuizAttempts += directSubjectQuiz.attemptsCount;
    }

    for (const ch of list) {
      if (ch.studyMetrics?.quiz) {
        subjectQuizBest += ch.studyMetrics.quiz.bestScore;
        subjectQuizTotal += ch.studyMetrics.quiz.total;
        subjectQuizAttempts += ch.studyMetrics.quiz.attemptsCount;
      }
    }

    const subjectMetrics = {
      flashcards: subjectFcTotal > 0
        ? {
            mastered: subjectFcMastered,
            total: subjectFcTotal,
            score: subjectFcScore,
            maxScore: subjectFcMaxScore,
            percentage: subjectFcMaxScore > 0 ? Math.round((subjectFcScore / subjectFcMaxScore) * 100) : 0,
            summary: `${subjectFcMastered}/${subjectFcTotal} Mastered`,
          }
        : undefined,
      quiz: subjectQuizTotal > 0
        ? {
            bestScore: subjectQuizBest,
            total: subjectQuizTotal,
            percentage: Math.round((subjectQuizBest / subjectQuizTotal) * 100),
            attemptsCount: subjectQuizAttempts,
          }
        : undefined,
    };

    return {
      ...subject,
      chapters: list,
      noteCount: list.reduce((sum, chapter) => sum + chapter.noteCount, 0),
      studyMetrics: subjectMetrics,
    };
  });
}

async function deleteScopeArtifacts(db: Database, scopeType: "chapter" | "subject", ids: number[]) {
  if (!ids.length) return;
  await db.delete(generatedAssets).where(and(eq(generatedAssets.scopeType, scopeType), inArray(generatedAssets.scopeId, ids)));
  await db.delete(chatMessages).where(and(eq(chatMessages.scopeType, scopeType), inArray(chatMessages.scopeId, ids)));
}

async function exportBundle(db: Database, kind: string, id: number, format: string) {
  const tree = await loadTree(db);
  let selected = tree;
  if (kind === "subject") selected = tree.filter((subject) => subject.id === id);
  if (kind === "chapter") {
    selected = tree
      .map((subject) => ({ ...subject, chapters: subject.chapters.filter((chapter) => chapter.id === id) }))
      .filter((subject) => subject.chapters.length);
  }
  if (!selected.length) throw new HttpError("Nothing to export.", 404);

  const bundle = [] as Array<Record<string, unknown>>;
  const markdown: string[] = [];
  for (const subject of selected) {
    const chapterBundles = [] as Array<Record<string, unknown>>;
    markdown.push(`# ${subject.name}\n`);
    if (subject.description) markdown.push(`${subject.description}\n`);
    for (const chapter of subject.chapters) {
      const noteRows = await db.select().from(notes).where(eq(notes.chapterId, chapter.id)).orderBy(asc(notes.createdAt));
      const assets = await db.select().from(generatedAssets).where(and(eq(generatedAssets.scopeType, "chapter"), eq(generatedAssets.scopeId, chapter.id)));
      const chats = await db.select().from(chatMessages).where(and(eq(chatMessages.scopeType, "chapter"), eq(chatMessages.scopeId, chapter.id))).orderBy(asc(chatMessages.id));
      chapterBundles.push({ id: chapter.id, name: chapter.name, notes: noteRows, generatedAssets: assets, chat: chats });
      markdown.push(`## ${chapter.name}\n`);
      for (const note of noteRows) {
        markdown.push(`### ${note.title}\n\n_Source: ${note.sourceType}${note.sourceLabel ? ` — ${note.sourceLabel}` : ""}_\n\n${note.content}\n`);
      }
    }
    const subjectAssets = kind === "chapter" ? [] : await db.select().from(generatedAssets).where(and(eq(generatedAssets.scopeType, "subject"), eq(generatedAssets.scopeId, subject.id)));
    const subjectChats = kind === "chapter" ? [] : await db.select().from(chatMessages).where(and(eq(chatMessages.scopeType, "subject"), eq(chatMessages.scopeId, subject.id))).orderBy(asc(chatMessages.id));
    bundle.push({ id: subject.id, name: subject.name, description: subject.description, chapters: chapterBundles, generatedAssets: subjectAssets, chat: subjectChats });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const base = kind === "all" ? "nitroai-library" : `nitroai-${kind}-${id}`;
  if (format === "md") {
    return new Response(markdown.join("\n"), {
      headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${base}-${stamp}.md"` },
    });
  }
  return new Response(JSON.stringify({ app: "NitroAI", exportedAt: new Date().toISOString(), subjects: bundle }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${base}-${stamp}.json"` },
  });
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const params = request.nextUrl.searchParams;
    const exportKind = params.get("export");
    if (exportKind) {
      if (!["subject", "chapter", "all"].includes(exportKind)) throw new HttpError("Unknown export type.");
      return await exportBundle(db, exportKind, Number(params.get("id") ?? 0), params.get("format") ?? "json");
    }
    return ok({ subjects: await loadTree(db) });
  } catch (error) {
    return fail(error, "Collections could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const db = await getDb();
    const name = cleanText(body.name, 160);
    if (!name) throw new HttpError("A name is required.");

    if (body.kind === "subject") {
      const [{ total }] = await db.select({ total: count() }).from(subjects);
      const [subject] = await db.insert(subjects).values({ name, description: cleanText(body.description, 2000), position: Number(total) }).returning();
      return ok({ subject }, 201);
    }
    if (body.kind === "chapter") {
      const subjectId = requireInt(body.subjectId, "Subject");
      const [{ total }] = await db.select({ total: count() }).from(chapters).where(eq(chapters.subjectId, subjectId));
      const [chapter] = await db.insert(chapters).values({ subjectId, name, position: Number(total) }).returning();
      return ok({ chapter }, 201);
    }
    throw new HttpError("Unknown collection type.");
  } catch (error) {
    return fail(error, "The collection could not be created.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readJson(request);
    const db = await getDb();
    const id = requireInt(body.id, "Collection id");
    const direction = body.move === "up" ? -1 : body.move === "down" ? 1 : 0;

    if (body.kind === "subject") {
      const patch: Partial<typeof subjects.$inferInsert> = { updatedAt: new Date() };
      if (body.name !== undefined) {
        patch.name = cleanText(body.name, 160);
        if (!patch.name) throw new HttpError("A name is required.");
      }
      if (body.description !== undefined) patch.description = cleanText(body.description, 2000);
      await db.update(subjects).set(patch).where(eq(subjects.id, id));
      if (direction) {
        const siblings = await db.select({ id: subjects.id }).from(subjects).orderBy(asc(subjects.position), asc(subjects.id));
        const order = siblings.map((s) => s.id);
        const index = order.indexOf(id);
        const target = index + direction;
        if (index >= 0 && target >= 0 && target < order.length) [order[index], order[target]] = [order[target], order[index]];
        for (const [position, subjectId] of order.entries()) await db.update(subjects).set({ position }).where(eq(subjects.id, subjectId));
      }
      return ok({ ok: true });
    }

    if (body.kind === "chapter") {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
      if (!chapter) throw new HttpError("Chapter not found.", 404);
      const patch: Partial<typeof chapters.$inferInsert> = { updatedAt: new Date() };
      if (body.name !== undefined) {
        patch.name = cleanText(body.name, 160);
        if (!patch.name) throw new HttpError("A name is required.");
      }
      let subjectId = chapter.subjectId;
      if (body.subjectId !== undefined && Number(body.subjectId) !== chapter.subjectId) {
        subjectId = requireInt(body.subjectId, "Target subject");
        const [{ total }] = await db.select({ total: count() }).from(chapters).where(eq(chapters.subjectId, subjectId));
        patch.subjectId = subjectId;
        patch.position = Number(total);
      }
      await db.update(chapters).set(patch).where(eq(chapters.id, id));
      if (patch.subjectId !== undefined) {
        // Keep denormalised chunk scope columns in sync so subject-wide retrieval stays correct.
        const noteIds = (await db.select({ id: notes.id }).from(notes).where(eq(notes.chapterId, id))).map((n) => n.id);
        if (noteIds.length) {
          await db.update(chunks).set({ subjectId }).where(inArray(chunks.noteId, noteIds));
        }
      }
      if (direction) {
        const siblings = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.subjectId, subjectId)).orderBy(asc(chapters.position), asc(chapters.id));
        const order = siblings.map((c) => c.id);
        const index = order.indexOf(id);
        const target = index + direction;
        if (index >= 0 && target >= 0 && target < order.length) [order[index], order[target]] = [order[target], order[index]];
        for (const [position, chapterId] of order.entries()) await db.update(chapters).set({ position }).where(eq(chapters.id, chapterId));
      }
      return ok({ ok: true });
    }
    throw new HttpError("Unknown collection type.");
  } catch (error) {
    return fail(error, "The collection could not be updated.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const id = requireInt(params.get("id"), "Collection id");
    const kind = params.get("kind");
    const db = await getDb();
    if (kind === "chapter") {
      await deleteScopeArtifacts(db, "chapter", [id]);
      await db.delete(chapters).where(eq(chapters.id, id));
      return ok({ ok: true });
    }
    if (kind === "subject") {
      const chapterIds = (await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.subjectId, id))).map((c) => c.id);
      await deleteScopeArtifacts(db, "chapter", chapterIds);
      await deleteScopeArtifacts(db, "subject", [id]);
      await db.delete(subjects).where(eq(subjects.id, id));
      return ok({ ok: true });
    }
    throw new HttpError("Unknown collection type.");
  } catch (error) {
    return fail(error, "The collection could not be deleted.");
  }
}
