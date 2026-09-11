import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { chatMessages, type Citation } from "@/db/schema";
import { answerQuestion } from "@/lib/ai/generate";
import { cleanText, fail, HttpError, ok, parseScope, readJson } from "@/lib/http";
import { loadScope, retrieveContext } from "@/lib/rag";
import { getProviderConfig, requireProvider } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = parseScope(params.get("scopeType"), params.get("scopeId"));
    const db = await getDb();
    const messages = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.scopeType, scope.scopeType), eq(chatMessages.scopeId, scope.scopeId)))
      .orderBy(asc(chatMessages.id));
    return ok({ messages });
  } catch (error) {
    return fail(error, "Chat history could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const scope = parseScope(body.scopeType, body.scopeId);
    const message = cleanText(body.message, 6000);
    if (!message) throw new HttpError("Type a question first.");
    const noteIds = Array.isArray(body.noteIds) ? body.noteIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20) : [];

    const db = await getDb();
    const cfg = requireProvider(await getProviderConfig());
    const scopeInfo = await loadScope(db, scope);
    if (!scopeInfo) throw new HttpError("The selected collection no longer exists.", 404);

    const history = (
      await db
        .select({ role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(and(eq(chatMessages.scopeType, scope.scopeType), eq(chatMessages.scopeId, scope.scopeId)))
        .orderBy(asc(chatMessages.id))
    )
      .slice(-8)
      .map((row) => ({ role: row.role === "assistant" ? ("assistant" as const) : ("user" as const), content: row.content }));

    let retrieved = await retrieveContext(db, cfg, scope, message, { noteIds, limit: 6 });
    if (noteIds.length && retrieved.length < 3) {
      const extra = await retrieveContext(db, cfg, scope, message, { limit: 6 });
      const seen = new Set(retrieved.map((r) => r.chunkId));
      retrieved = [...retrieved, ...extra.filter((r) => !seen.has(r.chunkId))].slice(0, 6).map((r, i) => ({ ...r, n: i + 1 }));
    }

    const personalization = typeof body.personalization === "string" ? cleanText(body.personalization, 1500) : undefined;

    const answer = await answerQuestion(
      cfg,
      message,
      retrieved.map((r) => ({ n: r.n, title: r.noteTitle, content: r.content })),
      history,
      scopeInfo.title,
      personalization,
    );
    const citations: Citation[] = retrieved.map((r) => ({ n: r.n, noteId: r.noteId, noteTitle: r.noteTitle, chunkId: r.chunkId, snippet: r.content.slice(0, 280) }));

    const [userRow] = await db.insert(chatMessages).values({ scopeType: scope.scopeType, scopeId: scope.scopeId, role: "user", content: message, citations: [] }).returning();
    const [assistantRow] = await db.insert(chatMessages).values({ scopeType: scope.scopeType, scopeId: scope.scopeId, role: "assistant", content: answer, citations }).returning();
    return ok({ messages: [userRow, assistantRow] });
  } catch (error) {
    return fail(error, "Verity could not answer right now.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = parseScope(params.get("scopeType"), params.get("scopeId"));
    const db = await getDb();
    await db.delete(chatMessages).where(and(eq(chatMessages.scopeType, scope.scopeType), eq(chatMessages.scopeId, scope.scopeId)));
    return ok({ ok: true });
  } catch (error) {
    return fail(error, "Chat history could not be cleared.");
  }
}
