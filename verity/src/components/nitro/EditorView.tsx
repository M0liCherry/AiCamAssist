"use client";

import { ArrowLeft, AtSign, Bot, Check, Clock3, Edit3, Eraser, FileText, FolderInput, History, PanelRightClose, PanelRightOpen, RefreshCw, Save, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage, formatDate } from "./client";
import { buildPersonalizationPrompt, getStoredPersonalization } from "./personalization";
import type { ChatMsg, Citation, NoteFull, NoteSummary, Scope, Subject } from "./types";
import { AiErrorAlert, EmptyState, ItemMenu, MarkdownDocument, Modal, Spinner } from "./ui";

export function EditorView({ noteId, subjects, scope, scopeTitle, onScope, aiReady, providerName, onBack, onOpenNote, onNoteChanged, onConfigureAi, notify }: {
  noteId: number | null;
  subjects: Subject[];
  scope: Scope | null;
  scopeTitle: string;
  onScope: (scope: Scope) => void;
  aiReady: boolean;
  providerName: string;
  onBack: () => void;
  onOpenNote: (noteId: number, chapterId: number) => void;
  onNoteChanged: () => Promise<unknown>;
  onConfigureAi: () => void;
  notify: (text: string, tone?: "success" | "info" | "error") => void;
}) {
  const [note, setNote] = useState<NoteFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<unknown>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [scopeNotes, setScopeNotes] = useState<NoteSummary[]>([]);
  const dirty = note ? title !== note.title || content !== note.content : false;

  const loadNote = useCallback(async () => {
    if (!noteId) {
      setNote(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ note: NoteFull }>(`/api/notes?id=${noteId}`);
      setNote(data.note);
      setTitle(data.note.title);
      setContent(data.note.content);
      setEditing(data.note.content.trim().length === 0 || data.note.sourceType === "blank");
    } catch (error) {
      notify(errorMessage(error), "error");
      setNote(null);
    } finally {
      setLoading(false);
    }
  }, [noteId, notify]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  useEffect(() => {
    if (!scope) return;
    api<{ notes: NoteSummary[] }>(`/api/notes?scopeType=${scope.scopeType}&scopeId=${scope.scopeId}`).then((data) => setScopeNotes(data.notes)).catch(() => setScopeNotes([]));
  }, [scope, note?.updatedAt]);

  const save = useCallback(async () => {
    if (!note || !dirty) return;
    setSaving(true);
    try {
      const data = await api<{ note: NoteFull }>("/api/notes", { method: "PATCH", json: { id: note.id, title: title.trim() || "Untitled note", content } });
      setNote({ ...note, ...data.note });
      setTitle(data.note.title);
      await onNoteChanged();
      notify("Note saved and re-indexed.");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }, [note, dirty, title, content, onNoteChanged, notify]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save]);

  const summarize = useCallback(async () => {
    if (!note) return;
    if (!aiReady) return onConfigureAi();
    setSummarizing(true);
    setSummaryError(null);
    try {
      const data = await api<{ note: NoteFull }>("/api/notes", { method: "POST", json: { action: "summarize", noteId: note.id } });
      setNote({ ...note, summary: data.note.summary });
      notify("Summary generated.");
    } catch (error) {
      setSummaryError(error);
    } finally {
      setSummarizing(false);
    }
  }, [note, aiReady, onConfigureAi, notify]);

  const moveNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!note || !moveTarget) return;
    try {
      await api("/api/notes", { method: "PATCH", json: { id: note.id, chapterId: Number(moveTarget) } });
      setMoveOpen(false);
      await onNoteChanged();
      onOpenNote(note.id, Number(moveTarget));
      notify("Note moved.");
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  const deleteNote = async () => {
    if (!note || !window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    try {
      await api(`/api/notes?id=${note.id}`, { method: "DELETE" });
      await onNoteChanged();
      notify("Note deleted.");
      onBack();
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  if (!noteId || (!loading && !note)) {
    return (
      <main className="study-view page-enter" aria-labelledby="editor-empty-title">
        <h1 id="editor-empty-title" className="sr-only">Document editor</h1>
        <EmptyState icon={<FileText size={28} />} title="Open a note to start editing" copy={scopeNotes.length ? "Choose one of the notes in the current scope below, or pick another from the Notes hub." : "Import or create a note in the Notes hub, then it will open here with the Nitro assistant beside it."} action={<button type="button" className="primary-button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Go to Notes hub</button>} />
        {scopeNotes.length > 0 && (
          <ul className="notes-list compact-list" aria-label="Notes in current scope">
            {scopeNotes.map((item) => <li className="note-row" key={item.id}><button type="button" className="note-open" onClick={() => onOpenNote(item.id, item.chapterId)}><span className="note-icon" aria-hidden="true"><FileText size={16} /></span><span className="note-meta"><strong>{item.title}</strong><small>{item.wordCount.toLocaleString()} words · {item.sourceType}</small></span></button></li>)}
          </ul>
        )}
      </main>
    );
  }

  return (
    <div className={`editor-view page-enter ${assistantOpen ? "" : "editor-view--wide"}`}>
      <header className="editor-toolbar">
        <div className="editor-title-group">
          <button type="button" className="icon-button" onClick={onBack} aria-label="Back to notes hub"><ArrowLeft size={19} aria-hidden="true" /></button>
          <span className="editor-file-icon" aria-hidden="true"><FileText size={17} /></span>
          <input aria-label="Document title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} />
        </div>
        <div className="toolbar-actions">
          <span className="save-state" role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : <><Check size={14} aria-hidden="true" /> Saved</>}</span>
          <div className="history-wrap">
            <button type="button" className="icon-button" onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen} aria-label="Document history"><History size={18} aria-hidden="true" /></button>
            {historyOpen && note && (
              <div className="history-popover" role="status">
                <Clock3 size={16} aria-hidden="true" />
                <span><strong>Stored locally</strong>Created {formatDate(note.createdAt)} · edited {formatDate(note.updatedAt)}<br />Source: {note.sourceType}{note.sourceLabel ? ` — ${note.sourceLabel}` : ""}<br />Index: {note.indexState === "embedded" ? "semantic + keyword" : note.indexState === "lexical" ? "keyword only" : "none"}</span>
              </div>
            )}
          </div>
          <button type="button" className="secondary-button compact" onClick={() => setEditing((value) => !value)} aria-pressed={editing}><Edit3 size={15} aria-hidden="true" />{editing ? "Preview" : "Edit"}</button>
          <button type="button" className="secondary-button compact" onClick={summarize} disabled={summarizing}>{summarizing ? <Spinner label="Summarizing" /> : <><Sparkles size={15} aria-hidden="true" />{note?.summary ? "Re-summarize" : "Summarize"}</>}</button>
          <button type="button" className="primary-button compact" onClick={save} disabled={saving || !dirty}><Save size={15} aria-hidden="true" />Save</button>
          <ItemMenu label="More document options" items={[
            { label: "Move to another chapter…", icon: <FolderInput size={14} aria-hidden="true" />, onSelect: () => { setMoveTarget(String(note?.chapterId ?? "")); setMoveOpen(true); } },
            { label: "Re-index for search", icon: <RefreshCw size={14} aria-hidden="true" />, onSelect: () => void api("/api/notes", { method: "POST", json: { action: "reindex", noteId } }).then(() => { notify("Note re-indexed."); void loadNote(); }).catch((error) => notify(errorMessage(error), "error")) },
            { label: "Delete note", icon: <Trash2 size={14} aria-hidden="true" />, danger: true, onSelect: () => void deleteNote() },
          ]} />
          <button type="button" className="icon-button panel-toggle" onClick={() => setAssistantOpen((value) => !value)} aria-label={assistantOpen ? "Close Nitro assistant" : "Open Nitro assistant"} aria-expanded={assistantOpen}>{assistantOpen ? <PanelRightClose size={19} aria-hidden="true" /> : <PanelRightOpen size={19} aria-hidden="true" />}</button>
        </div>
      </header>

      <div className="workspace-panels">
        <main className="document-panel" aria-label="Document editor" aria-busy={loading}>
          <div className="doc-context-bar">
            <span><Sparkles size={14} aria-hidden="true" /> {note ? `${note.subjectName} › ${note.chapterName}` : ""}</span>
            <span>{note ? `${note.wordCount.toLocaleString()} words` : ""}</span>
          </div>
          {summaryError ? <div className="doc-alert"><AiErrorAlert error={summaryError} onRetry={() => void summarize()} onConfigure={onConfigureAi} /></div> : null}
          {note?.summary && !editing && (
            <section className="summary-card" aria-labelledby="summary-title">
              <h2 id="summary-title"><Sparkles size={15} aria-hidden="true" /> AI summary <small>generated by {providerName} · verify against the source</small></h2>
              <MarkdownDocument content={note.summary} compact />
            </section>
          )}
          {editing ? (
            <label className="document-textarea-label">
              <span className="sr-only">Edit Markdown note content</span>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck aria-describedby="markdown-help" />
              <small id="markdown-help">Markdown supported (# headings, - lists, **bold**). Ctrl+S saves and rebuilds the search index.</small>
            </label>
          ) : (
            <MarkdownDocument content={content || "_This note is empty. Switch to Edit to add content._"} />
          )}
        </main>

        {assistantOpen && scope && (
          <AssistantPanel scope={scope} scopeTitle={scopeTitle} subjects={subjects} onScope={onScope} scopeNotes={scopeNotes} activeNote={note} aiReady={aiReady} providerName={providerName} onConfigureAi={onConfigureAi} onOpenNote={onOpenNote} onClose={() => setAssistantOpen(false)} notify={notify} />
        )}
      </div>

      <Modal open={moveOpen} title="Move note" description="Choose the chapter that should own this note." onClose={() => setMoveOpen(false)}>
        <form className="folder-form" onSubmit={moveNote}>
          <label className="field"><span>Destination chapter</span>
            <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
              {subjects.map((subject) => <optgroup label={subject.name} key={subject.id}>{subject.chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.name}</option>)}</optgroup>)}
            </select>
          </label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setMoveOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={!moveTarget || Number(moveTarget) === note?.chapterId}>Move note</button></div>
        </form>
      </Modal>
    </div>
  );
}

function AssistantPanel({ scope, scopeTitle, subjects, onScope, scopeNotes, activeNote, aiReady, providerName, onConfigureAi, onOpenNote, onClose, notify }: {
  scope: Scope;
  scopeTitle: string;
  subjects: Subject[];
  onScope: (scope: Scope) => void;
  scopeNotes: NoteSummary[];
  activeNote: NoteFull | null;
  aiReady: boolean;
  providerName: string;
  onConfigureAi: () => void;
  onOpenNote: (noteId: number, chapterId: number) => void;
  onClose: () => void;
  notify: (text: string, tone?: "success" | "info" | "error") => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [refs, setRefs] = useState<NoteSummary[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [openSource, setOpenSource] = useState<{ messageId: number; n: number } | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const lastQuestion = useRef<{ question: string; noteIds: number[] } | null>(null);
  const subject = useMemo(() => subjects.find((s) => (scope.scopeType === "subject" ? s.id === scope.scopeId : s.chapters.some((c) => c.id === scope.scopeId))), [subjects, scope]);

  useEffect(() => {
    setError(null);
    api<{ messages: ChatMsg[] }>(`/api/chat?scopeType=${scope.scopeType}&scopeId=${scope.scopeId}`).then((data) => setMessages(data.messages)).catch((err) => setError(err));
  }, [scope]);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const ask = useCallback(
    async (question: string, noteIds: number[]) => {
      if (!question || sending) return;
      if (!aiReady) return onConfigureAi();
      lastQuestion.current = { question, noteIds };
      setSending(true);
      setError(null);
      const optimistic: ChatMsg = { id: -Date.now(), role: "user", content: question, citations: [], createdAt: new Date().toISOString() };
      setMessages((current) => [...current, optimistic]);
      setDraft("");
      try {
        const persPrompt = buildPersonalizationPrompt(getStoredPersonalization());
        const data = await api<{ messages: ChatMsg[] }>("/api/chat", {
          method: "POST",
          json: { scopeType: scope.scopeType, scopeId: scope.scopeId, message: question, noteIds, personalization: persPrompt },
        });
        setMessages((current) => [...current.filter((m) => m.id !== optimistic.id), ...data.messages]);
        setRefs([]);
      } catch (err) {
        setMessages((current) => current.filter((m) => m.id !== optimistic.id));
        setDraft(question);
        setError(err);
      } finally {
        setSending(false);
      }
    },
    [sending, aiReady, onConfigureAi, scope],
  );

  const send = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft.trim(), refs.map((r) => r.id));
  };
  const retryLast = () => {
    if (lastQuestion.current) void ask(lastQuestion.current.question, lastQuestion.current.noteIds);
  };

  const clear = async () => {
    if (!messages.length || !window.confirm("Clear this conversation? Notes are not affected.")) return;
    try {
      await api(`/api/chat?scopeType=${scope.scopeType}&scopeId=${scope.scopeId}`, { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    setMentionOpen(/(^|\s)@[\w-]*$/.test(value));
  };
  const addRef = (item: NoteSummary) => {
    setRefs((current) => (current.some((r) => r.id === item.id) ? current : [...current, item]));
    setDraft((value) => value.replace(/(^|\s)@[\w-]*$/, "$1"));
    setMentionOpen(false);
    document.getElementById("nitro-question")?.focus();
  };
  const mentionCandidates = scopeNotes.filter((item) => !refs.some((r) => r.id === item.id)).slice(0, 8);

  return (
    <aside className="assistant-panel" aria-label="Nitro AI assistant">
      <div className="assistant-head">
        <span className="nitro-orb" aria-hidden="true"><Sparkles size={17} /></span>
        <div><strong>Nitro</strong><small><span className={`status-dot ${aiReady ? "ok" : "bad"}`} aria-hidden="true" /> {aiReady ? providerName : "No AI backend"}</small></div>
        <button type="button" className="text-button" onClick={clear} disabled={!messages.length} aria-label="Clear conversation"><Eraser size={14} aria-hidden="true" /></button>
        <button type="button" className="icon-button assistant-close" onClick={onClose} aria-label="Close assistant"><X size={17} aria-hidden="true" /></button>
      </div>
      {subject && (
        <div className="assistant-scope" role="group" aria-label="Assistant knowledge scope">
          <button type="button" className={scope.scopeType === "chapter" ? "active" : ""} aria-pressed={scope.scopeType === "chapter"} onClick={() => { const chapterId = activeNote?.chapterId ?? subject.chapters[0]?.id; if (chapterId) onScope({ scopeType: "chapter", scopeId: chapterId }); }}>This chapter</button>
          <button type="button" className={scope.scopeType === "subject" ? "active" : ""} aria-pressed={scope.scopeType === "subject"} onClick={() => onScope({ scopeType: "subject", scopeId: subject.id })}>Entire subject</button>
          <small title={scopeTitle}>{scopeNotes.length} note{scopeNotes.length === 1 ? "" : "s"} in scope</small>
        </div>
      )}
      <div className="chat-history" ref={historyRef} aria-live="polite" aria-label="Conversation">
        {!messages.length && (
          <div className="assistant-intro">
            <span aria-hidden="true" className="assistant-intro-logo"><img src="/logo.png" alt="Verity" className="intro-logo-img" /></span>
            <h2>Hey, it&#39;s me, it&#39;s Verity</h2>
            <div className="intro-description">
              <p>Ask me anything</p>
              <p>I know about a million things</p>
              <p>I&#39;ll do everything</p>
            </div>
            {!aiReady && <button type="button" className="secondary-button compact" onClick={onConfigureAi}><Sparkles size={14} aria-hidden="true" />Connect an AI backend</button>}
          </div>
        )}
        {messages.map((message) => (
          <div className={`chat-message chat-message--${message.role}`} key={message.id}>
            <span className="message-avatar" aria-label={message.role === "assistant" ? "Verity" : "You"}>{message.role === "assistant" ? <img src="/logo.png" alt="" className="msg-avatar-img" /> : "Y"}</span>
            <div className="message-body">
              {message.role === "assistant" ? <MarkdownDocument content={message.content} compact onCite={(n) => setOpenSource({ messageId: message.id, n })} /> : <p>{message.content}</p>}
              {message.citations.length > 0 && (
                <details className="citation-list" open={openSource?.messageId === message.id}>
                  <summary>Sources ({message.citations.length})</summary>
                  {message.citations.map((citation: Citation) => (
                    <div className={`citation ${openSource?.messageId === message.id && openSource.n === citation.n ? "highlight" : ""}`} key={citation.n} id={`cite-${message.id}-${citation.n}`}>
                      <span className="cite-badge" aria-hidden="true">{citation.n}</span>
                      <div><strong>{citation.noteTitle}</strong><p>{citation.snippet}…</p><button type="button" className="text-button" onClick={() => { const item = scopeNotes.find((s) => s.id === citation.noteId); onOpenNote(citation.noteId, item?.chapterId ?? activeNote?.chapterId ?? scope.scopeId); }}>Open note</button></div>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="chat-message chat-message--assistant"><span className="message-avatar" aria-hidden="true"><img src="/logo.png" alt="" className="msg-avatar-img" /></span><div className="message-body"><p className="thinking"><Spinner label="Verity is reading your notes…" /></p></div></div>}
      </div>
      <form className="assistant-composer" onSubmit={send}>
        {mentionOpen && mentionCandidates.length > 0 && (
          <div className="mention-menu" role="listbox" aria-label="Reference a note">
            <small>Pin a note as a source</small>
            {mentionCandidates.map((item) => <button type="button" role="option" aria-selected="false" key={item.id} onClick={() => addRef(item)}><FileText size={14} aria-hidden="true" />{item.title}</button>)}
          </div>
        )}
        {refs.length > 0 && <div className="ref-chips" aria-label="Pinned notes">{refs.map((item) => <span className="mention-chip" key={item.id}>@{item.title}<button type="button" onClick={() => setRefs((current) => current.filter((r) => r.id !== item.id))} aria-label={`Remove ${item.title}`}><X size={12} aria-hidden="true" /></button></span>)}</div>}
        <label htmlFor="nitro-question" className="sr-only">Ask Nitro a question</label>
        <textarea id="nitro-question" value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(draft.trim(), refs.map((r) => r.id)); } if (event.key === "Escape") setMentionOpen(false); }} placeholder={aiReady ? "Ask about your notes… type @ to reference a note" : "Connect an AI backend in Settings to chat"} rows={2} disabled={sending} />
        <AiErrorAlert error={error} onRetry={lastQuestion.current ? retryLast : undefined} onConfigure={onConfigureAi} />
        <div className="composer-actions">
          <div>
            <button type="button" className="icon-button" onClick={() => { setDraft((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@`); setMentionOpen(true); }} aria-label="Reference a note" disabled={!scopeNotes.length}><AtSign size={18} aria-hidden="true" /></button>
          </div>
          <button type="submit" className="send-button" disabled={!draft.trim() || sending} aria-label="Send message"><Send size={17} aria-hidden="true" /></button>
        </div>
        <small className="composer-disclaimer"><ShieldCheck size={11} aria-hidden="true" /> Answers come from your notes via {aiReady ? providerName : "your chosen model"} and may still contain mistakes — check the cited passages.</small>
      </form>
    </aside>
  );
}
