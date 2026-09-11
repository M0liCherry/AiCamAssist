"use client";

import { AudioLines, FilePlus2, FileUp, Link2, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { api, errorMessage, transcribeAudio } from "./client";
import type { Chapter, NoteSummary, Subject } from "./types";
import { ConsentField, InlineAlert, Modal, ProgressBar } from "./ui";

export type ImportType = "blank" | "audio" | "document" | "website";

export const IMPORT_CARDS: { type: ImportType; title: string; copy: string; icon: typeof FileUp; tone: string }[] = [
  { type: "blank", title: "Blank document", copy: "Write a Markdown note from scratch", icon: FilePlus2, tone: "violet" },
  { type: "audio", title: "Upload audio", copy: "Transcribe a lecture or recording locally", icon: AudioLines, tone: "blue" },
  { type: "document", title: "Document upload", copy: "PDF, DOCX, PPTX, TXT, Markdown", icon: FileUp, tone: "amber" },
  { type: "website", title: "Website / YouTube link", copy: "Import an article or video captions", icon: Link2, tone: "green" },
];

const NEW = "__new";

export function ImportModal({ type, subjects, defaultChapterId, onClose, onCreated, onTreeChanged }: {
  type: ImportType;
  subjects: Subject[];
  defaultChapterId: number | null;
  onClose: () => void;
  onCreated: (notes: NoteSummary[], chapterId: number) => void;
  onTreeChanged: () => Promise<unknown>;
}) {
  const card = IMPORT_CARDS.find((item) => item.type === type)!;
  const defaultSubject = subjects.find((s) => s.chapters.some((c) => c.id === defaultChapterId)) ?? subjects[0];
  const [subjectId, setSubjectId] = useState<string>(defaultSubject ? String(defaultSubject.id) : NEW);
  const [newSubject, setNewSubject] = useState("");
  const [chapterId, setChapterId] = useState<string>(defaultChapterId ? String(defaultChapterId) : defaultSubject?.chapters[0] ? String(defaultSubject.chapters[0].id) : NEW);
  const [newChapter, setNewChapter] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ percent: number | null; label: string } | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const chaptersForSubject: Chapter[] = useMemo(() => subjects.find((s) => String(s.id) === subjectId)?.chapters ?? [], [subjects, subjectId]);

  const ensureDestination = async () => {
    let resolvedSubject = subjectId === NEW ? null : Number(subjectId);
    if (resolvedSubject === null) {
      if (!newSubject.trim()) throw new Error("Name the new subject.");
      const data = await api<{ subject: { id: number } }>("/api/subjects", { method: "POST", json: { kind: "subject", name: newSubject.trim() } });
      resolvedSubject = data.subject.id;
    }
    let resolvedChapter = chapterId === NEW || subjectId === NEW ? null : Number(chapterId);
    if (resolvedChapter === null) {
      if (!newChapter.trim()) throw new Error("Name the new chapter.");
      const data = await api<{ chapter: { id: number } }>("/api/subjects", { method: "POST", json: { kind: "chapter", subjectId: resolvedSubject, name: newChapter.trim() } });
      resolvedChapter = data.chapter.id;
    }
    return resolvedChapter;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setWarnings([]);
    if (!consent) return setError("Please confirm the processing notice.");
    if ((type === "document" || type === "audio") && !files.length) return setError("Choose a file first.");
    if (type === "website" && !url.trim()) return setError("Paste a link first.");
    setBusy(true);
    try {
      const destination = await ensureDestination();
      let created: NoteSummary[] = [];
      if (type === "blank") {
        setProgress({ percent: null, label: "Creating document…" });
        const data = await api<{ note: NoteSummary }>("/api/notes", { method: "POST", json: { chapterId: destination, title: title || "Untitled note", content: `# ${title || "Untitled note"}\n\n` } });
        created = [data.note];
      } else if (type === "document") {
        setProgress({ percent: null, label: `Parsing and indexing ${files.length} file${files.length === 1 ? "" : "s"}…` });
        const form = new FormData();
        form.set("chapterId", String(destination));
        form.set("consent", "true");
        files.forEach((file) => form.append("files", file));
        const data = await api<{ notes: NoteSummary[]; errors: { file: string; message: string }[] }>("/api/import", { method: "POST", body: form });
        created = data.notes;
        if (data.errors.length) setWarnings(data.errors.map((e) => `${e.file}: ${e.message}`));
      } else if (type === "website") {
        setProgress({ percent: null, label: "Fetching and indexing the page…" });
        const data = await api<{ notes: NoteSummary[] }>("/api/import", { method: "POST", json: { chapterId: destination, kind: "url", url: url.trim(), title, consent: true } });
        created = data.notes;
      } else {
        const file = files[0];
        const transcript = await transcribeAudio(file, setProgress, language || undefined);
        if (!transcript.trim()) throw new Error("No speech was recognised in this recording.");
        setProgress({ percent: 100, label: "Saving transcript and building the index…" });
        const data = await api<{ notes: NoteSummary[] }>("/api/import", {
          method: "POST",
          json: { chapterId: destination, kind: "text", text: transcript, title: title || file.name.replace(/\.[^.]+$/, ""), sourceType: "audio", sourceLabel: file.name, consent: true },
        });
        created = data.notes;
      }
      await onTreeChanged();
      onCreated(created, destination);
    } catch (err) {
      setError(errorMessage(err, "The import failed."));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const accept = type === "audio" ? "audio/*,.m4a,.mp3,.wav,.ogg,.flac,.webm" : ".pdf,.docx,.pptx,.txt,.md,.markdown,.html,.htm,.csv,.json";

  return (
    <Modal open title={card.title} description={card.copy} onClose={busy ? () => undefined : onClose}>
      <form className="import-form" onSubmit={submit}>
        <fieldset className="dest-grid">
          <legend>Save to</legend>
          <label className="field">
            <span>Subject</span>
            <select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); const first = subjects.find((s) => String(s.id) === event.target.value)?.chapters[0]; setChapterId(first ? String(first.id) : NEW); }}>
              {subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
              <option value={NEW}>+ New subject…</option>
            </select>
            {subjectId === NEW && <input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="e.g. Database Systems" aria-label="New subject name" maxLength={160} required />}
          </label>
          <label className="field">
            <span>Chapter</span>
            <select value={subjectId === NEW ? NEW : chapterId} onChange={(event) => setChapterId(event.target.value)} disabled={subjectId === NEW}>
              {chaptersForSubject.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.name}</option>)}
              <option value={NEW}>+ New chapter…</option>
            </select>
            {(chapterId === NEW || subjectId === NEW) && <input value={newChapter} onChange={(event) => setNewChapter(event.target.value)} placeholder="e.g. Chapter 2: NoSQL" aria-label="New chapter name" maxLength={160} required />}
          </label>
        </fieldset>

        <label className="field">
          <span>Title <em>optional</em></span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} placeholder={type === "document" ? "Defaults to each file name" : "Defaults to the source title"} />
        </label>

        {type === "website" && (
          <label className="field">
            <span>Public URL</span>
            <input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://… or a YouTube link" />
            <small>Articles are converted to text on this PC. YouTube imports use the video's caption track; videos without captions cannot be imported.</small>
          </label>
        )}

        {(type === "document" || type === "audio") && (
          <label className="file-drop">
            <input type="file" accept={accept} multiple={type === "document"} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
            <FileUp size={22} aria-hidden="true" />
            <span>
              <strong>{files.length ? files.map((f) => f.name).join(", ") : type === "audio" ? "Choose an audio file" : "Choose up to 20 files"}</strong>
              <small>{type === "audio" ? "MP3, WAV, M4A, OGG, FLAC · transcribed locally with Whisper" : "PDF, DOCX, PPTX, TXT, MD, HTML · parsed locally"}</small>
            </span>
          </label>
        )}

        {type === "audio" && (
          <label className="field">
            <span>Spoken language <em>optional</em></span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="">Auto-detect</option>
              {[["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"], ["it", "Italian"], ["hi", "Hindi"], ["zh", "Chinese"], ["ja", "Japanese"], ["ar", "Arabic"]].map(([code, label]) => <option value={code} key={code}>{label}</option>)}
            </select>
            <small>The first transcription downloads the Whisper model (about 75 MB for whisper-base) into your data folder; afterwards it runs offline.</small>
          </label>
        )}

        <div className="processing-notice">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            <strong>Processing notice</strong>
            {type === "website"
              ? "Verity fetches the address you provide. Only import pages you are permitted to use for study."
              : type === "audio"
                ? "Audio is decoded and transcribed on this computer. The transcript becomes a note and is indexed with your chosen AI backend."
                : "Files are parsed on this computer. Extracted text is stored locally and indexed with your chosen AI backend (cloud providers receive text only for embeddings if selected)."}
          </span>
        </div>
        <ConsentField id="import-consent" checked={consent} onChange={setConsent}>
          I have the right to use this material and agree to the <a href="/legal/privacy" target="_blank">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a> for this import.
        </ConsentField>

        {progress && (
          <div className="progress-block" aria-live="polite">
            <span>{progress.label}</span>
            <ProgressBar value={progress.percent} label={progress.label} />
          </div>
        )}
        {warnings.map((warning) => <InlineAlert tone="warning" key={warning}>{warning}</InlineAlert>)}
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={!consent || busy}>{busy ? "Working…" : type === "blank" ? "Create document" : "Import"}</button>
        </div>
      </form>
    </Modal>
  );
}
