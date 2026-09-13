import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, type Database } from "@/db";
import { chapters, notes } from "@/db/schema";
import { cleanText, fail, HttpError, ok, readJson, requireInt } from "@/lib/http";
import { countWords, importFromUrl, normalizeText, parseUploadedFile, type ParsedSource } from "@/lib/ingest";
import { generateStudyNotesFromTranscript } from "@/lib/ai/generate";
import { indexNote } from "@/lib/rag";
import { getProviderConfig } from "@/lib/settings";
import type { ProviderConfig } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

async function storeSource(db: Database, cfg: ProviderConfig, chapterId: number, subjectId: number, source: ParsedSource, titleOverride: string) {
  const noteTitle = titleOverride || source.title;
  let noteContent = source.text;

  if (source.sourceType === "youtube" || source.sourceType === "audio") {
    if (cfg.provider !== "none") {
      try {
        noteContent = await generateStudyNotesFromTranscript(cfg, noteTitle, source.text, source.sourceLabel, source.sourceType);
      } catch {
        noteContent = `# ${noteTitle}\n\n*Source: [${source.sourceLabel}](${source.sourceLabel})*\n\n## Overview\nTranscribed from ${source.sourceType === "youtube" ? "YouTube video" : "audio recording"}.\n\n## Transcript & Notes\n\n${source.text}`;
      }
    } else {
      noteContent = `# ${noteTitle}\n\n*Source: [${source.sourceLabel}](${source.sourceLabel})*\n\n## Overview\nTranscribed from ${source.sourceType === "youtube" ? "YouTube video" : "audio recording"}.\n\n## Transcript & Notes\n\n${source.text}`;
    }
  }

  if (source.sourceType === "youtube" && source.sourceLabel) {
    const linkLine = `*Source: [${source.sourceLabel}](${source.sourceLabel})*`;
    if (!noteContent.includes(source.sourceLabel)) {
      const headingMatch = noteContent.match(/^#\s+[^\n]+\n+/);
      if (headingMatch) {
        noteContent = headingMatch[0] + `${linkLine}\n\n` + noteContent.slice(headingMatch[0].length);
      } else {
        noteContent = `${linkLine}\n\n` + noteContent;
      }
    }
  }

  const [note] = await db
    .insert(notes)
    .values({
      chapterId,
      title: noteTitle,
      content: noteContent,
      sourceType: source.sourceType,
      sourceLabel: source.sourceLabel.slice(0, 600),
      wordCount: countWords(noteContent),
      status: "processing",
      indexState: "none",
    })
    .returning();
  try {
    const indexState = await indexNote(db, cfg, note, subjectId);
    const [ready] = await db.update(notes).set({ status: "ready", indexState }).where(eq(notes.id, note.id)).returning();
    return ready;
  } catch (error) {
    const [ready] = await db
      .update(notes)
      .set({ status: "ready", indexState: "lexical", errorMessage: error instanceof Error ? error.message : "Indexing failed" })
      .where(eq(notes.id, note.id))
      .returning();
    return ready;
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const cfg = await getProviderConfig();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.get("consent") !== "true") throw new HttpError("Please confirm the privacy notice before importing files.");
      const chapterId = requireInt(form.get("chapterId"), "Chapter");
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
      if (!chapter) throw new HttpError("Chapter not found.", 404);
      const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      if (!files.length) throw new HttpError("Choose at least one file.");
      if (files.length > 20) throw new HttpError("Import up to 20 files at a time.");
      const created = [];
      const errors: { file: string; message: string }[] = [];
      for (const file of files) {
        try {
          const source = await parseUploadedFile(file);
          created.push(await storeSource(db, cfg, chapterId, chapter.subjectId, source, ""));
        } catch (error) {
          errors.push({ file: file.name, message: error instanceof Error ? error.message : "Import failed" });
        }
      }
      if (!created.length && errors.length) throw new HttpError(errors.map((e) => `${e.file}: ${e.message}`).join(" "), 422);
      return ok({ notes: created, errors }, 201);
    }

    const body = await readJson(request);
    if (body.consent !== true) throw new HttpError("Please confirm the privacy notice before importing.");
    const chapterId = requireInt(body.chapterId, "Chapter");
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (!chapter) throw new HttpError("Chapter not found.", 404);
    const title = cleanText(body.title, 300);

    if (body.kind === "url") {
      const source = await importFromUrl(cleanText(body.url, 2000));
      const note = await storeSource(db, cfg, chapterId, chapter.subjectId, source, title);
      return ok({ notes: [note], errors: [] }, 201);
    }

    if (body.kind === "text") {
      const text = normalizeText(typeof body.text === "string" ? body.text.slice(0, 1_500_000) : "");
      if (!text) throw new HttpError("The transcript or text is empty.");
      const source: ParsedSource = {
        title: title || cleanText(body.sourceLabel, 200) || "Imported text",
        text,
        sourceType: cleanText(body.sourceType, 32) || "text",
        sourceLabel: cleanText(body.sourceLabel, 600) || "Pasted text",
      };
      const note = await storeSource(db, cfg, chapterId, chapter.subjectId, source, title);
      return ok({ notes: [note], errors: [] }, 201);
    }

    throw new HttpError("Unknown import type.");
  } catch (error) {
    return fail(error, "The import failed.");
  }
}
