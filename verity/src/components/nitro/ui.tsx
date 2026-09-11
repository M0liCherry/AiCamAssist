"use client";

import { AlertTriangle, Check, ChevronDown, MoreHorizontal, RefreshCw, Settings, Sparkles, X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError, applySuggestedModel, errorMessage } from "./client";
import type { Scope, Subject } from "./types";

export function Modal({ open, title, description, onClose, children, wide = false }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card ${wide ? "modal-card--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? `${titleId}-desc` : undefined}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">NitroAI</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={`${titleId}-desc`}>{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title}`} autoFocus>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ConsentField({ id, checked, onChange, children, compact = false }: { id: string; checked: boolean; onChange: (value: boolean) => void; children: ReactNode; compact?: boolean }) {
  return (
    <label className={`consent-field ${compact ? "consent-field--compact" : ""}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function renderInline(text: string, onCite?: (n: number) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+(?:\]\[\d+|,\s*\d+)*\])/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else {
      const numbers = token.replace(/[[\]]/g, " ").split(/[\s,]+/).filter(Boolean).map(Number);
      parts.push(
        <span key={key++} className="cite-group">
          {numbers.map((n) =>
            onCite ? (
              <button type="button" key={n} className="cite-badge" onClick={() => onCite(n)} aria-label={`Show source ${n}`}>{n}</button>
            ) : (
              <span key={n} className="cite-badge">{n}</span>
            ),
          )}
        </span>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Text-only Markdown renderer (headings, lists, quotes, code blocks). Never injects HTML. */
export function MarkdownDocument({ content, onCite, compact = false }: { content: string; onCite?: (n: number) => void; compact?: boolean }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let codeBuffer: string[] | null = null;
  lines.forEach((line, index) => {
    const key = `${index}`;
    if (line.trim().startsWith("```")) {
      if (codeBuffer) {
        blocks.push(<pre key={key}><code>{codeBuffer.join("\n")}</code></pre>);
        codeBuffer = null;
      } else codeBuffer = [];
      return;
    }
    if (codeBuffer) {
      codeBuffer.push(line);
      return;
    }
    if (line.startsWith("### ")) blocks.push(<h3 key={key}>{renderInline(line.slice(4), onCite)}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={key}>{renderInline(line.slice(3), onCite)}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h1 key={key}>{renderInline(line.slice(2), onCite)}</h1>);
    else if (/^\s*\d+\.\s/.test(line)) blocks.push(<p className="list-line" key={key}><span>{line.match(/\d+/)?.[0]}.</span><span>{renderInline(line.replace(/^\s*\d+\.\s/, ""), onCite)}</span></p>);
    else if (/^\s*[-*•]\s/.test(line)) blocks.push(<p className="list-line" key={key}><span aria-hidden="true">•</span><span>{renderInline(line.replace(/^\s*[-*•]\s/, ""), onCite)}</span></p>);
    else if (line.startsWith("> ")) blocks.push(<blockquote key={key}>{renderInline(line.slice(2), onCite)}</blockquote>);
    else if (!line.trim()) blocks.push(<div className="doc-spacer" key={key} aria-hidden="true" />);
    else blocks.push(<p key={key}>{renderInline(line, onCite)}</p>);
  });
  if (codeBuffer) blocks.push(<pre key="tail"><code>{(codeBuffer as string[]).join("\n")}</code></pre>);
  return <div className={`markdown-document ${compact ? "markdown-document--compact" : ""}`}>{blocks}</div>;
}

export function StatusPill({ label, value, color }: { label: string; value: number | string; color: "blue" | "amber" | "green" }) {
  return (
    <span className={`status-pill status-pill--${color}`}>
      <strong>{value}</strong> {label}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="progress-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? "In progress" : `${value}%`}>
      <i className={value === null ? "indeterminate" : ""} style={value === null ? undefined : { width: `${value}%` }} />
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="loading-mark" role="status">
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

export function InlineAlert({ tone, children }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  return (
    <div className={`inline-alert inline-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {tone === "success" ? <Check size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}

/**
 * Error banner for AI actions. When the provider reported a retired model and
 * named a replacement, offers a one-click "switch and retry"; when no backend
 * is configured, links to Settings.
 */
export function AiErrorAlert({ error, onRetry, onConfigure }: { error: unknown; onRetry?: () => void; onConfigure?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : null;
  const suggested = apiError?.suggestedModel;
  const switchModel = async () => {
    if (!suggested) return;
    setBusy(true);
    setFailure("");
    try {
      await applySuggestedModel(suggested);
      onRetry?.();
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inline-alert inline-alert--error ai-error" role="alert">
      <AlertTriangle size={15} aria-hidden="true" />
      <div className="ai-error-body">
        <span>{errorMessage(error)}</span>
        {failure && <span className="ai-error-followup">{failure}</span>}
        <div className="ai-error-actions">
          {suggested && (
            <button type="button" className="primary-button compact" onClick={switchModel} disabled={busy}>
              <RefreshCw size={14} aria-hidden="true" />
              {busy ? "Switching…" : `Switch to ${suggested} and retry`}
            </button>
          )}
          {!suggested && onRetry && apiError?.code !== "no_provider" && (
            <button type="button" className="secondary-button compact" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" />Try again</button>
          )}
          {onConfigure && (apiError?.code === "no_provider" || apiError?.code === "model_not_found" || apiError?.code === "unauthorized") && (
            <button type="button" className="secondary-button compact" onClick={onConfigure}><Settings size={14} aria-hidden="true" />Open AI backend settings</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, copy, action }: { icon: ReactNode; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-illustration" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean };

/** Accessible overflow menu: Escape closes, arrow keys move, click outside dismisses. */
export function ItemMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDocument = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDocument);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDocument);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const elements = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const current = elements.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (current + 1) % elements.length : (current - 1 + elements.length) % elements.length;
    elements[next]?.focus();
  };
  return (
    <div className="item-menu" ref={ref}>
      <button type="button" className="icon-button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" id={id} className="menu-popover" onKeyDown={onMenuKey} aria-label={label}>
          {items.map((item) => (
            <button type="button" role="menuitem" key={item.label} className={item.danger ? "danger" : ""} disabled={item.disabled} onClick={(event) => { event.stopPropagation(); setOpen(false); item.onSelect(); }}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Subject / chapter scope switcher shared by the study tools and the assistant. */
export function ScopeBar({ subjects, scope, onScope, trailing }: { subjects: Subject[]; scope: Scope | null; onScope: (scope: Scope) => void; trailing?: ReactNode }) {
  const activeSubject =
    scope?.scopeType === "subject" ? subjects.find((s) => s.id === scope.scopeId) : subjects.find((s) => s.chapters.some((c) => c.id === scope?.scopeId));
  if (!subjects.length) return null;
  return (
    <div className="scope-bar">
      <label>
        <span>Subject</span>
        <span className="select-wrap">
          <select value={activeSubject?.id ?? ""} onChange={(event) => { const subject = subjects.find((s) => s.id === Number(event.target.value)); if (!subject) return; onScope(subject.chapters[0] ? { scopeType: "chapter", scopeId: subject.chapters[0].id } : { scopeType: "subject", scopeId: subject.id }); }}>
            {subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </label>
      {activeSubject && (
        <label>
          <span>Scope</span>
          <span className="select-wrap">
            <select value={scope?.scopeType === "subject" ? "subject" : String(scope?.scopeId ?? "")} onChange={(event) => { const value = event.target.value; onScope(value === "subject" ? { scopeType: "subject", scopeId: activeSubject.id } : { scopeType: "chapter", scopeId: Number(value) }); }}>
              <option value="subject">Entire subject — all chapters ({activeSubject.noteCount} notes)</option>
              {activeSubject.chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.name} ({chapter.noteCount})</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
      )}
      {trailing && <div className="scope-trailing">{trailing}</div>}
    </div>
  );
}
