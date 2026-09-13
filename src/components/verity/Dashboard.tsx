"use client";

import { ArrowDown, ArrowRight, ArrowUp, AudioLines, BookOpen, ChevronDown, ChevronRight, Download, FileText, FolderPlus, FolderTree, Globe, Layers, Pencil, Plus, Search, Sparkles, Trash2, Trophy, Video } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadFile, errorMessage, formatDate } from "./client";
import { IMPORT_CARDS, ImportModal, type ImportType } from "./ImportModal";
import { aggregateSubjectScores, getChapterScores } from "./studyScores";
import type { NoteSummary, Scope, SearchHit, Subject } from "./types";
import { EmptyState, ItemMenu, Modal } from "./ui";

type CollectionModal =
  | { mode: "new-subject" }
  | { mode: "new-chapter"; subjectId: number }
  | { mode: "rename-subject"; subject: Subject }
  | { mode: "rename-chapter"; chapter: Subject["chapters"][number] }
  | { mode: "move-chapter"; chapter: Subject["chapters"][number] };

const SOURCE_ICON: Record<string, typeof FileText> = { audio: AudioLines, website: Globe, youtube: Video, document: FileText, blank: Pencil, text: FileText };

export function Dashboard({ subjects, scope, onScope, onOpenNote, onTreeChanged, notify, aiReady, onConfigureAi }: {
  subjects: Subject[];
  scope: Scope | null;
  onScope: (scope: Scope) => void;
  onOpenNote: (noteId: number, chapterId: number) => void;
  onTreeChanged: () => Promise<unknown>;
  notify: (text: string, tone?: "success" | "info" | "error") => void;
  aiReady: boolean;
  onConfigureAi: () => void;
}) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [collection, setCollection] = useState<CollectionModal | null>(null);
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<number>>(new Set());
  const [scoresVersion, setScoresVersion] = useState(0);

  useEffect(() => {
    const onScoreUpdate = () => setScoresVersion((v) => v + 1);
    window.addEventListener("verity:scores-updated", onScoreUpdate);
    return () => window.removeEventListener("verity:scores-updated", onScoreUpdate);
  }, []);

  const scopeInfo = useMemo(() => {
    if (!scope) return null;
    if (scope.scopeType === "subject") return { subject: subjects.find((s) => s.id === scope.scopeId) ?? null, chapter: null };
    for (const subject of subjects) {
      const chapter = subject.chapters.find((c) => c.id === scope.scopeId);
      if (chapter) return { subject, chapter };
    }
    return null;
  }, [scope, subjects]);

  const activeSubject = useMemo(() => {
    if (!scope) return subjects[0] ?? null;
    if (scope.scopeType === "subject") return subjects.find((s) => s.id === scope.scopeId) ?? subjects[0] ?? null;
    for (const sub of subjects) {
      if (sub.chapters.some((c) => c.id === scope.scopeId)) return sub;
    }
    return subjects[0] ?? null;
  }, [scope, subjects]);

  const activeSubjectScores = useMemo(() => {
    if (!activeSubject) return null;
    // scoresVersion referenced to recompute on score changes
    void scoresVersion;
    return aggregateSubjectScores(activeSubject);
  }, [activeSubject, scoresVersion]);

  // Tree badges must refresh on score changes too (verity:scores-updated).
  const treeScores = useMemo(() => {
    void scoresVersion;
    const subs = new Map<number, ReturnType<typeof aggregateSubjectScores>>();
    const chaps = new Map<number, ReturnType<typeof getChapterScores>>();
    for (const s of subjects) {
      subs.set(s.id, aggregateSubjectScores(s));
      for (const c of s.chapters) chaps.set(c.id, getChapterScores(c.id, s));
    }
    return { subs, chaps };
  }, [subjects, scoresVersion]);

  const loadNotes = useCallback(async () => {
    if (!scope) {
      setNotes([]);
      return;
    }
    setLoadingNotes(true);
    try {
      const data = await api<{ notes: NoteSummary[] }>(`/api/notes?scopeType=${scope.scopeType}&scopeId=${scope.scopeId}`);
      setNotes(data.notes);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setLoadingNotes(false);
    }
  }, [scope, notify]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes, subjects]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const data = await api<{ results: SearchHit[] }>(`/api/notes?q=${encodeURIComponent(term)}`);
        setResults(data.results);
      } catch (error) {
        notify(errorMessage(error), "error");
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search, notify]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("workspace-search")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await onTreeChanged();
      notify(success);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  const deleteSubject = (subject: Subject) => {
    if (!window.confirm(`Delete “${subject.name}” with ${subject.chapters.length} chapter(s) and ${subject.noteCount} note(s)? This cannot be undone.`)) return;
    void run(() => api(`/api/subjects?kind=subject&id=${subject.id}`, { method: "DELETE" }), "Subject deleted.");
  };
  const deleteChapter = (chapter: Subject["chapters"][number]) => {
    if (!window.confirm(`Delete “${chapter.name}” and its ${chapter.noteCount} note(s)? This cannot be undone.`)) return;
    void run(() => api(`/api/subjects?kind=chapter&id=${chapter.id}`, { method: "DELETE" }), "Chapter deleted.");
  };
  const deleteNote = (note: NoteSummary) => {
    if (!window.confirm(`Delete the note “${note.title}”?`)) return;
    void run(() => api(`/api/notes?id=${note.id}`, { method: "DELETE" }), "Note deleted.");
  };
  const move = (kind: "subject" | "chapter", id: number, direction: "up" | "down") => run(() => api("/api/subjects", { method: "PATCH", json: { kind, id, move: direction } }), "Order updated.");

  const toggleSubject = (id: number) =>
    setCollapsedSubjects((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const matchingCollections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) return [];
    const hits: { label: string; scope: Scope }[] = [];
    for (const subject of subjects) {
      if (subject.name.toLowerCase().includes(term)) hits.push({ label: subject.name, scope: { scopeType: "subject", scopeId: subject.id } });
      for (const chapter of subject.chapters) if (chapter.name.toLowerCase().includes(term)) hits.push({ label: `${subject.name} › ${chapter.name}`, scope: { scopeType: "chapter", scopeId: chapter.id } });
    }
    return hits;
  }, [search, subjects]);

  const hasLibrary = subjects.length > 0;

  return (
    <div className="dashboard-view page-enter">
      <header className="dashboard-header">
        <div>
          <div className="title-kicker"><BookOpen size={14} aria-hidden="true" /> Local library</div>
          <h1>Notes hub</h1>
          <p>{hasLibrary ? `${subjects.length} subject${subjects.length === 1 ? "" : "s"} · ${subjects.reduce((n, s) => n + s.chapters.length, 0)} chapters · ${subjects.reduce((n, s) => n + s.noteCount, 0)} notes stored on this PC` : "Create a subject, add chapters, then import your material."}</p>
        </div>
        <label className="search-box" htmlFor="workspace-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search all notes and collections</span>
          <input id="workspace-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes and collections" />
          <kbd>Ctrl K</kbd>
        </label>
      </header>

      {results !== null ? (
        <section className="search-results" aria-live="polite" aria-label="Search results">
          <div className="section-heading"><h2>Results for “{search.trim()}”</h2><button type="button" className="text-button" onClick={() => setSearch("")}>Clear</button></div>
          {matchingCollections.length > 0 && (
            <div className="result-group">
              <h3>Collections</h3>
              {matchingCollections.map((hit) => <button type="button" className="result-row" key={hit.label} onClick={() => { onScope(hit.scope); setSearch(""); }}><FolderTree size={16} aria-hidden="true" /><span>{hit.label}</span><ArrowRight size={14} aria-hidden="true" /></button>)}
            </div>
          )}
          <div className="result-group">
            <h3>Notes ({results.length})</h3>
            {results.length === 0 && <p className="help-text">No notes contain that text.</p>}
            {results.map((hit) => (
              <button type="button" className="result-row result-row--note" key={hit.id} onClick={() => onOpenNote(hit.id, hit.chapterId)}>
                <FileText size={16} aria-hidden="true" />
                <span><strong>{hit.title}</strong><small>{hit.subjectName} › {hit.chapterName}</small><em>{hit.snippet}</em></span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="hub-layout">
          <aside className="library-tree" aria-label="Subjects and chapters">
            <div className="tree-head"><h2>Library</h2><button type="button" className="secondary-button compact" onClick={() => setCollection({ mode: "new-subject" })}><FolderPlus size={15} aria-hidden="true" />New subject</button></div>
            {!hasLibrary && <p className="help-text tree-empty">No subjects yet. Subjects hold chapters; chapters hold notes.</p>}
            <ul className="tree-list">
              {subjects.map((subject, subjectIndex) => {
                const collapsed = collapsedSubjects.has(subject.id);
                const subjectActive = scope?.scopeType === "subject" && scope.scopeId === subject.id;
                const subjectScores = treeScores.subs.get(subject.id);
                return (
                  <li className="tree-subject" key={subject.id}>
                    <div className={`tree-row ${subjectActive ? "active" : ""}`}>
                      <button type="button" className="tree-toggle" onClick={() => toggleSubject(subject.id)} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${subject.name}`}>{collapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}</button>
                      <button type="button" className="tree-label" onClick={() => onScope({ scopeType: "subject", scopeId: subject.id })} aria-current={subjectActive ? "true" : undefined}>
                        <BookOpen size={15} aria-hidden="true" />
                        <span>{subject.name}</span>
                        {subjectScores && subjectScores.flashcards.percentage > 0 && <span className="tree-score-badge" title={`Subject mastery: ${subjectScores.flashcards.percentage}%`}>{subjectScores.flashcards.percentage}%</span>}
                        <small>{subject.noteCount}</small>
                      </button>
                      <ItemMenu label={`Actions for ${subject.name}`} items={[
                        { label: "New chapter", icon: <Plus size={14} aria-hidden="true" />, onSelect: () => setCollection({ mode: "new-chapter", subjectId: subject.id }) },
                        { label: "Rename", icon: <Pencil size={14} aria-hidden="true" />, onSelect: () => setCollection({ mode: "rename-subject", subject }) },
                        { label: "Move up", icon: <ArrowUp size={14} aria-hidden="true" />, disabled: subjectIndex === 0, onSelect: () => void move("subject", subject.id, "up") },
                        { label: "Move down", icon: <ArrowDown size={14} aria-hidden="true" />, disabled: subjectIndex === subjects.length - 1, onSelect: () => void move("subject", subject.id, "down") },
                        { label: "Export JSON", icon: <Download size={14} aria-hidden="true" />, onSelect: () => downloadFile(`/api/subjects?export=subject&id=${subject.id}&format=json`) },
                        { label: "Export Markdown", icon: <Download size={14} aria-hidden="true" />, onSelect: () => downloadFile(`/api/subjects?export=subject&id=${subject.id}&format=md`) },
                        { label: "Delete subject", icon: <Trash2 size={14} aria-hidden="true" />, danger: true, onSelect: () => deleteSubject(subject) },
                      ]} />
                    </div>
                    {!collapsed && (
                      <ul className="tree-children">
                        {subject.chapters.map((chapter, chapterIndex) => {
                          const active = scope?.scopeType === "chapter" && scope.scopeId === chapter.id;
                          const chScores = treeScores.chaps.get(chapter.id);
                          return (
                            <li key={chapter.id}>
                              <div className={`tree-row tree-row--chapter ${active ? "active" : ""}`}>
                                <button type="button" className="tree-label" onClick={() => onScope({ scopeType: "chapter", scopeId: chapter.id })} aria-current={active ? "true" : undefined}>
                                  <Layers size={14} aria-hidden="true" />
                                  <span>{chapter.name}</span>
                                  {chScores?.flashcards && chScores.flashcards.percentage > 0 && <span className="tree-score-badge tree-score-badge--chapter" title={`Chapter flashcards: ${chScores.flashcards.percentage}%`}>{chScores.flashcards.percentage}%</span>}
                                  <small>{chapter.noteCount}</small>
                                </button>
                                <ItemMenu label={`Actions for ${chapter.name}`} items={[
                                  { label: "Rename", icon: <Pencil size={14} aria-hidden="true" />, onSelect: () => setCollection({ mode: "rename-chapter", chapter }) },
                                  { label: "Move up", icon: <ArrowUp size={14} aria-hidden="true" />, disabled: chapterIndex === 0, onSelect: () => void move("chapter", chapter.id, "up") },
                                  { label: "Move down", icon: <ArrowDown size={14} aria-hidden="true" />, disabled: chapterIndex === subject.chapters.length - 1, onSelect: () => void move("chapter", chapter.id, "down") },
                                  { label: "Move to another subject…", icon: <FolderTree size={14} aria-hidden="true" />, disabled: subjects.length < 2, onSelect: () => setCollection({ mode: "move-chapter", chapter }) },
                                  { label: "Export JSON", icon: <Download size={14} aria-hidden="true" />, onSelect: () => downloadFile(`/api/subjects?export=chapter&id=${chapter.id}&format=json`) },
                                  { label: "Export Markdown", icon: <Download size={14} aria-hidden="true" />, onSelect: () => downloadFile(`/api/subjects?export=chapter&id=${chapter.id}&format=md`) },
                                  { label: "Delete chapter", icon: <Trash2 size={14} aria-hidden="true" />, danger: true, onSelect: () => deleteChapter(chapter) },
                                ]} />
                              </div>
                            </li>
                          );
                        })}
                        <li><button type="button" className="tree-add" onClick={() => setCollection({ mode: "new-chapter", subjectId: subject.id })}><Plus size={13} aria-hidden="true" />Add chapter</button></li>
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="hub-content">
            {activeSubject && (
              <section className="subject-overview-card" aria-label="Subject study metrics and mastery">
                <div className="overview-header">
                  <div>
                    <span className="eyebrow">Subject Performance &amp; Metrics</span>
                    <h2>{activeSubject.name}</h2>
                  </div>
                  {activeSubjectScores?.flashcards && (
                    <div className="top-level-summary-pill" title="Top-level subject score summary">
                      <Trophy size={15} aria-hidden="true" />
                      <span>Subject Mastery:</span>
                      <strong>{activeSubjectScores.flashcards.percentage}%</strong>
                    </div>
                  )}
                </div>

                <div className="overview-stats-grid">
                  <div className="overview-stat-card">
                    <div className="stat-card-top">
                      <span className="stat-label">Flashcard Mastery</span>
                      <span className="stat-pct">{activeSubjectScores?.flashcards.percentage ?? 0}%</span>
                    </div>
                    <div className="stat-main">
                      <div className="stat-hero-row">
                        <strong className="stat-percentage-hero">{activeSubjectScores?.flashcards.percentage ?? 0}%</strong>
                        <span className="stat-best-badge">Best: {activeSubjectScores?.flashcards.score ?? 0} pts</span>
                      </div>
                      <span className="stat-sub">
                        Mastery aligned by retention &bull; Best score recorded
                      </span>
                    </div>
                    <div className="overview-progress-bar" role="progressbar" aria-label="Flashcard mastery" aria-valuenow={activeSubjectScores?.flashcards.percentage ?? 0} aria-valuemin={0} aria-valuemax={100}>
                      <i style={{ width: `${activeSubjectScores?.flashcards.percentage ?? 0}%` }} />
                    </div>
                  </div>

                  <div className="overview-stat-card">
                    <div className="stat-card-top">
                      <span className="stat-label">Quiz Performance</span>
                      <span className="stat-pct">{activeSubjectScores?.quiz.total ? `${activeSubjectScores.quiz.percentage}%` : "—"}</span>
                    </div>
                    <div className="stat-main">
                      <div className="stat-hero-row">
                        <strong className="stat-percentage-hero">{activeSubjectScores?.quiz.total ? `${activeSubjectScores.quiz.percentage}%` : "0%"}</strong>
                        <span className="stat-best-badge">Best: {activeSubjectScores?.quiz.bestScore ?? 0} pts</span>
                      </div>
                      <span className="stat-sub">
                        {activeSubjectScores?.quiz.attemptsCount ?? 0} attempt{(activeSubjectScores?.quiz.attemptsCount ?? 0) === 1 ? "" : "s"} tracked across chapters
                      </span>
                    </div>
                    <div className="overview-progress-bar" role="progressbar" aria-label="Quiz performance" aria-valuenow={activeSubjectScores?.quiz.percentage ?? 0} aria-valuemin={0} aria-valuemax={100}>
                      <i style={{ width: `${activeSubjectScores?.quiz.percentage ?? 0}%` }} />
                    </div>
                  </div>
                </div>

                {activeSubject.chapters.length > 0 && (
                  <div className="chapter-scores-list">
                    <h3>Chapter Breakdown</h3>
                    <div className="chapter-scores-grid">
                      {activeSubject.chapters.map((ch) => {
                        const chScores = getChapterScores(ch.id, activeSubject);
                        const isCurrent = scope?.scopeType === "chapter" && scope.scopeId === ch.id;
                        return (
                          <button
                            type="button"
                            className={`chapter-score-card ${isCurrent ? "active" : ""}`}
                            key={ch.id}
                            onClick={() => onScope({ scopeType: "chapter", scopeId: ch.id })}
                          >
                            <div className="chapter-card-name">
                              <Layers size={13} aria-hidden="true" />
                              <span>{ch.name}</span>
                            </div>
                            <div className="chapter-card-metrics">
                              <span className={`chip chip--fc ${chScores.flashcards ? "has-score" : ""}`}>
                                {chScores.flashcards ? `${chScores.flashcards.percentage}% (Best: ${chScores.flashcards.score} pts)` : "0% (Best: 0 pts)"}
                              </span>
                              <span className={`chip chip--quiz ${chScores.quiz ? "has-score" : ""}`}>
                                {chScores.quiz ? `${chScores.quiz.percentage}% (Best: ${chScores.quiz.bestScore} pts)` : "No quiz"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section aria-labelledby="create-heading" className="create-section">
              <div className="section-heading">
                <div><h2 id="create-heading">Create new notes</h2><p>{scopeInfo?.chapter ? `Imports save to ${scopeInfo.subject?.name} › ${scopeInfo.chapter.name}` : "Pick or create a chapter during import."}</p></div>
                {!aiReady && <button type="button" className="text-button" onClick={onConfigureAi}><Sparkles size={14} aria-hidden="true" />Connect an AI backend for search & study tools</button>}
              </div>
              <div className="import-grid">
                {IMPORT_CARDS.map(({ type, title, copy, icon: Icon, tone }) => (
                  <button type="button" className="import-card" key={type} onClick={() => setImportType(type)}>
                    <span className={`icon-badge icon-badge--${tone}`} aria-hidden="true"><Icon size={24} /></span>
                    <span><strong>{title}</strong><small>{copy}</small></span>
                    <ArrowRight size={20} className="import-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>

            <section className="library-section" aria-labelledby="notes-heading">
              <div className="library-toolbar">
                <h2 id="notes-heading">{scopeInfo ? (scopeInfo.chapter ? `${scopeInfo.subject?.name} › ${scopeInfo.chapter.name}` : `${scopeInfo.subject?.name} · all chapters`) : "Notes"}</h2>
                {scopeInfo?.subject && <div className="segmented" role="group" aria-label="Note scope">
                  <button type="button" className={scope?.scopeType === "chapter" ? "active" : ""} disabled={!scopeInfo.chapter && !scopeInfo.subject.chapters.length} onClick={() => { const chapter = scopeInfo.chapter ?? scopeInfo.subject!.chapters[0]; if (chapter) onScope({ scopeType: "chapter", scopeId: chapter.id }); }} aria-pressed={scope?.scopeType === "chapter"}>Chapter</button>
                  <button type="button" className={scope?.scopeType === "subject" ? "active" : ""} onClick={() => onScope({ scopeType: "subject", scopeId: scopeInfo.subject!.id })} aria-pressed={scope?.scopeType === "subject"}>Entire subject</button>
                </div>}
              </div>

              {!hasLibrary ? (
                <div className="zero-state">
                  <span className="empty-illustration" aria-hidden="true"><FolderTree size={30} /></span>
                  <h3>Your library is empty</h3>
                  <p>Start with a subject such as “Database Systems”, add chapters like “Chapter 1: Relational SQL”, then import PDFs, slides, recordings, or links into each chapter. Everything is stored locally.</p>
                  <div className="zero-actions">
                    <button type="button" className="primary-button" onClick={() => setCollection({ mode: "new-subject" })}><FolderPlus size={16} aria-hidden="true" />Create your first subject</button>
                    <button type="button" className="secondary-button" onClick={() => setImportType("document")}><FileText size={16} aria-hidden="true" />Import a document</button>
                  </div>
                </div>
              ) : loadingNotes ? (
                <div className="note-grid" aria-busy="true" aria-label="Loading notes">{[1, 2, 3].map((i) => <div className="note-card note-skeleton" key={i} />)}</div>
              ) : notes.length ? (
                <ul className="notes-list">
                  {notes.map((note) => {
                    const Icon = SOURCE_ICON[note.sourceType] ?? FileText;
                    return (
                      <li className="note-row" key={note.id}>
                        <button type="button" className="note-open" onClick={() => onOpenNote(note.id, note.chapterId)}>
                          <span className="note-icon" aria-hidden="true"><Icon size={17} /></span>
                          <span className="note-meta">
                            <strong>{note.title}</strong>
                            <small>{note.sourceType} · {note.wordCount.toLocaleString()} words · updated {formatDate(note.updatedAt)}{note.sourceLabel ? ` · ${note.sourceLabel}` : ""}</small>
                          </span>
                          <span className={`badge badge--${note.indexState}`}>{note.indexState === "embedded" ? "Semantic index" : note.indexState === "lexical" ? "Keyword index" : "Not indexed"}</span>
                        </button>
                        <ItemMenu label={`Actions for ${note.title}`} items={[
                          { label: "Open", icon: <FileText size={14} aria-hidden="true" />, onSelect: () => onOpenNote(note.id, note.chapterId) },
                          { label: "Re-index", icon: <Sparkles size={14} aria-hidden="true" />, onSelect: () => void run(() => api("/api/notes", { method: "POST", json: { action: "reindex", noteId: note.id } }), "Note re-indexed.") },
                          { label: "Delete note", icon: <Trash2 size={14} aria-hidden="true" />, danger: true, onSelect: () => deleteNote(note) },
                        ]} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<FileText size={28} />} title={scopeInfo?.chapter ? "This chapter has no notes yet" : "No notes in this scope yet"} copy="Use the cards above to add a document, recording, link, or blank note." />
              )}
            </section>
          </section>
        </div>
      )}

      {importType && (
        <ImportModal type={importType} subjects={subjects} defaultChapterId={scope?.scopeType === "chapter" ? scope.scopeId : null} onClose={() => setImportType(null)} onTreeChanged={onTreeChanged} onCreated={(created, chapterId) => { setImportType(null); onScope({ scopeType: "chapter", scopeId: chapterId }); notify(`${created.length} note${created.length === 1 ? "" : "s"} added and indexed.`); if (created.length === 1) onOpenNote(created[0].id, chapterId); }} />
      )}
      {collection && <CollectionDialog state={collection} subjects={subjects} onClose={() => setCollection(null)} onDone={async (message, nextScope) => { setCollection(null); await onTreeChanged(); if (nextScope) onScope(nextScope); notify(message); }} notify={notify} />}
    </div>
  );
}

function CollectionDialog({ state, subjects, onClose, onDone, notify }: { state: CollectionModal; subjects: Subject[]; onClose: () => void; onDone: (message: string, scope?: Scope) => Promise<void>; notify: (text: string, tone?: "success" | "info" | "error") => void }) {
  const initialName = state.mode === "rename-subject" ? state.subject.name : state.mode === "rename-chapter" ? state.chapter.name : "";
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(state.mode === "rename-subject" ? state.subject.description : "");
  const [target, setTarget] = useState(state.mode === "move-chapter" ? String(subjects.find((s) => s.id !== state.chapter.subjectId)?.id ?? "") : "");
  const [busy, setBusy] = useState(false);
  const titles: Record<CollectionModal["mode"], string> = { "new-subject": "New subject", "new-chapter": "New chapter", "rename-subject": "Rename subject", "rename-chapter": "Rename chapter", "move-chapter": "Move chapter" };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (state.mode === "new-subject") {
        const data = await api<{ subject: { id: number } }>("/api/subjects", { method: "POST", json: { kind: "subject", name, description } });
        await onDone("Subject created. Add a chapter to start importing.", { scopeType: "subject", scopeId: data.subject.id });
      } else if (state.mode === "new-chapter") {
        const data = await api<{ chapter: { id: number } }>("/api/subjects", { method: "POST", json: { kind: "chapter", subjectId: state.subjectId, name } });
        await onDone("Chapter created.", { scopeType: "chapter", scopeId: data.chapter.id });
      } else if (state.mode === "rename-subject") {
        await api("/api/subjects", { method: "PATCH", json: { kind: "subject", id: state.subject.id, name, description } });
        await onDone("Subject renamed.");
      } else if (state.mode === "rename-chapter") {
        await api("/api/subjects", { method: "PATCH", json: { kind: "chapter", id: state.chapter.id, name } });
        await onDone("Chapter renamed.");
      } else {
        await api("/api/subjects", { method: "PATCH", json: { kind: "chapter", id: state.chapter.id, subjectId: Number(target) } });
        await onDone("Chapter moved.", { scopeType: "chapter", scopeId: state.chapter.id });
      }
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={titles[state.mode]} onClose={onClose} description={state.mode === "move-chapter" ? `Move “${state.chapter.name}” and all of its notes.` : undefined}>
      <form className="folder-form" onSubmit={submit}>
        {state.mode !== "move-chapter" && (
          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required autoFocus placeholder={state.mode.includes("subject") ? "e.g. Database Systems" : "e.g. Chapter 2: NoSQL"} /></label>
        )}
        {(state.mode === "new-subject" || state.mode === "rename-subject") && (
          <label className="field"><span>Description <em>optional</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={2000} placeholder="What this subject covers" /></label>
        )}
        {state.mode === "move-chapter" && (
          <label className="field"><span>Destination subject</span><select value={target} onChange={(event) => setTarget(event.target.value)} required>{subjects.filter((s) => s.id !== state.chapter.subjectId).map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        )}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={busy || (state.mode !== "move-chapter" && !name.trim())}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </Modal>
  );
}
