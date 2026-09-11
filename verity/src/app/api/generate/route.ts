import { and, asc, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, type Database } from "@/db";
import { flashcardProgress, generatedAssets, quizAttempts } from "@/db/schema";
import { buildDigest, generateFlashcards, generatePodcast, generateQuiz, type PodcastLength } from "@/lib/ai/generate";
import { contextBudgetChars } from "@/lib/ai/provider";
import { fail, HttpError, ok, parseScope, readJson, requireInt } from "@/lib/http";
import { loadScope } from "@/lib/rag";
import { getProviderConfig, requireProvider } from "@/lib/settings";

export const dynamic = "force-dynamic";

const KINDS = ["podcast", "flashcards", "quiz"] as const;
type Kind = (typeof KINDS)[number];

async function withDetails(db: Database, asset: typeof generatedAssets.$inferSelect | undefined) {
  if (!asset) return { asset: null, progress: [], attempts: [] };
  const progress = asset.kind === "flashcards" ? await db.select().from(flashcardProgress).where(eq(flashcardProgress.assetId, asset.id)).orderBy(asc(flashcardProgress.cardIndex)) : [];
  const attempts = asset.kind === "quiz" ? await db.select().from(quizAttempts).where(eq(quizAttempts.assetId, asset.id)).orderBy(desc(quizAttempts.id)).limit(10) : [];
  return { asset, progress, attempts };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = parseScope(params.get("scopeType"), params.get("scopeId"));
    const kind = params.get("kind") as Kind;
    if (!KINDS.includes(kind)) throw new HttpError("Unknown asset kind.");
    const db = await getDb();
    const [asset] = await db
      .select()
      .from(generatedAssets)
      .where(and(eq(generatedAssets.scopeType, scope.scopeType), eq(generatedAssets.scopeId, scope.scopeId), eq(generatedAssets.kind, kind)))
      .orderBy(desc(generatedAssets.id))
      .limit(1);
    return ok(await withDetails(db, asset));
  } catch (error) {
    return fail(error, "Generated content could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const scope = parseScope(body.scopeType, body.scopeId);
    const kind = body.kind as Kind;
    if (!KINDS.includes(kind)) throw new HttpError("Unknown asset kind.");
    const db = await getDb();
    const cfg = requireProvider(await getProviderConfig());
    const scopeInfo = await loadScope(db, scope);
    if (!scopeInfo) throw new HttpError("The selected collection no longer exists.", 404);
    if (!scopeInfo.notes.some((n) => n.content.trim())) {
      throw new HttpError(scope.scopeType === "chapter" ? "This chapter has no notes yet. Import a document, audio, or link first." : "This subject has no notes yet. Add notes to one of its chapters first.");
    }
    const digest = buildDigest(scopeInfo.notes, contextBudgetChars(cfg));
    const options: Record<string, unknown> = { truncated: digest.truncated, provider: cfg.provider, model: cfg.model };
    let payload: unknown;

    if (kind === "podcast") {
      const length = (["short", "medium", "long"].includes(String(body.length)) ? String(body.length) : "short") as PodcastLength;
      options.length = length;
      payload = await generatePodcast(cfg, digest.text, scopeInfo.title, length);
    } else if (kind === "flashcards") {
      const rawCount = Number(body.count);
      const count = Number.isInteger(rawCount) && rawCount >= 1 && rawCount <= 100 ? rawCount : 12;
      options.count = count;
      payload = { cards: await generateFlashcards(cfg, digest.text, scopeInfo.title, count) };
    } else {
      const difficulty = ["Beginner", "Intermediate", "Advanced"].includes(String(body.difficulty)) ? String(body.difficulty) : "Intermediate";
      const count = [5, 10, 20].includes(Number(body.count)) ? Number(body.count) : 10;
      Object.assign(options, { difficulty, count });
      payload = { questions: await generateQuiz(cfg, digest.text, scopeInfo.title, difficulty, count) };
    }

    const [asset] = await db
      .insert(generatedAssets)
      .values({ scopeType: scope.scopeType, scopeId: scope.scopeId, kind, options, payload, sourceNoteCount: scopeInfo.notes.length })
      .returning();
    if (kind === "flashcards") {
      const cards = (payload as { cards: unknown[] }).cards;
      await db.insert(flashcardProgress).values(cards.map((_, cardIndex) => ({ assetId: asset.id, cardIndex, status: "new" })));
    }
    return ok(await withDetails(db, asset), 201);
  } catch (error) {
    return fail(error, "Generation failed.");
  }
}

/** Records spaced-repetition reviews and quiz attempts. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await readJson(request);
    const assetId = requireInt(body.assetId, "Asset id");
    const db = await getDb();

    if (body.rating !== undefined) {
      const cardIndex = Number(body.cardIndex);
      if (!Number.isInteger(cardIndex) || cardIndex < 0) throw new HttpError("Card index is required.");
      const rating = String(body.rating);
      if (!["again", "good", "easy"].includes(rating)) throw new HttpError("Unknown rating.");
      const [current] = await db.select().from(flashcardProgress).where(and(eq(flashcardProgress.assetId, assetId), eq(flashcardProgress.cardIndex, cardIndex)));
      if (!current) throw new HttpError("Card not found.", 404);
      let intervalDays = current.intervalDays;
      let status = current.status;
      if (rating === "again") {
        intervalDays = 0;
        status = "learning";
      } else {
        const growth = rating === "easy" ? 3 : 2;
        intervalDays = intervalDays === 0 ? (rating === "easy" ? 3 : 1) : Math.min(120, intervalDays * growth);
        status = intervalDays >= 7 ? "mastered" : "learning";
      }
      const dueAt = new Date(Date.now() + (intervalDays === 0 ? 10 * 60 * 1000 : intervalDays * 24 * 60 * 60 * 1000));
      await db.update(flashcardProgress).set({ intervalDays, status, dueAt, reviews: current.reviews + 1, updatedAt: new Date() }).where(eq(flashcardProgress.id, current.id));
      const progress = await db.select().from(flashcardProgress).where(eq(flashcardProgress.assetId, assetId)).orderBy(asc(flashcardProgress.cardIndex));
      return ok({ progress });
    }

    if (body.attempt && typeof body.attempt === "object") {
      const attempt = body.attempt as { answers?: Record<string, number>; score?: number; total?: number; topicBreakdown?: Record<string, { correct: number; total: number }> };
      await db.insert(quizAttempts).values({
        assetId,
        answers: attempt.answers ?? {},
        score: Number(attempt.score ?? 0),
        total: Number(attempt.total ?? 0),
        topicBreakdown: attempt.topicBreakdown ?? {},
      });
      const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.assetId, assetId)).orderBy(desc(quizAttempts.id)).limit(10);
      return ok({ attempts });
    }
    throw new HttpError("Nothing to update.");
  } catch (error) {
    return fail(error, "Progress could not be saved.");
  }
}
