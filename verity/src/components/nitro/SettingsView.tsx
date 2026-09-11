"use client";

import { Accessibility, ChevronRight, Cpu, Database, Download, HardDrive, Info, Mic, Moon, Palette, RefreshCw, ShieldCheck, Sparkles, Sun, Trash2, UserCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, downloadFile, errorMessage } from "./client";
import { ProviderForm } from "./Onboarding";
import {
  AiPersonalization,
  AiPersona,
  LearningStyle,
  getStoredPersonalization,
  saveStoredPersonalization,
  PERSONA_DESCRIPTIONS,
  LEARNING_STYLE_DESCRIPTIONS,
} from "./personalization";
import type { PublicSettings, SettingsResponse } from "./types";
import { InlineAlert, Modal } from "./ui";

export function SettingsView({ boot, onSettings, onReload, onTreeChanged, notify }: {
  boot: SettingsResponse;
  onSettings: (settings: PublicSettings) => void;
  onReload: () => Promise<unknown>;
  onTreeChanged: () => Promise<unknown>;
  notify: (text: string, tone?: "success" | "info" | "error") => void;
}) {
  const { settings, environment, publisher, presets, sttModels } = boot;
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState("");
  const [busy, setBusy] = useState<"" | "reindex" | "erase">("");
  const [personalization, setPersonalization] = useState<AiPersonalization>(() => getStoredPersonalization());
  const [persSaved, setPersSaved] = useState(false);

  useEffect(() => {
    setPersonalization(getStoredPersonalization());
  }, []);

  const savePersonalization = (patch: Partial<AiPersonalization>) => {
    const updated = saveStoredPersonalization(patch);
    setPersonalization(updated);
    setPersSaved(true);
    setTimeout(() => setPersSaved(false), 2500);
  };

  const update = async (patch: Record<string, unknown>, message: string) => {
    try {
      const data = await api<{ settings: PublicSettings }>("/api/settings", { method: "PUT", json: patch });
      onSettings(data.settings);
      document.documentElement.dataset.theme = data.settings.theme;
      notify(message);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  const reindexAll = async () => {
    setBusy("reindex");
    try {
      const data = await api<{ reindexed: number }>("/api/notes", { method: "POST", json: { action: "reindex" } });
      await onTreeChanged();
      notify(`${data.reindexed} note${data.reindexed === 1 ? "" : "s"} re-indexed with ${settings.provider === "none" ? "keyword search" : presets[settings.provider].shortLabel}.`);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  };

  const erase = async (event: FormEvent) => {
    event.preventDefault();
    if (eraseText !== "ERASE") return;
    setBusy("erase");
    try {
      await api("/api/settings?confirm=ERASE", { method: "DELETE" });
      setEraseOpen(false);
      await onTreeChanged();
      await onReload();
      notify("All local data was erased.");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  };

  const providerLabel = settings.provider === "none" ? "Not configured" : `${presets[settings.provider].label} · ${settings.model}`;

  return (
    <main className="settings-view page-enter" aria-labelledby="settings-title">
      <header>
        <p className="eyebrow">Preferences, profile &amp; legal</p>
        <h1 id="settings-title">Settings &amp; Profile</h1>
        <p>Everything here is stored locally on this computer. Active AI backend: <strong>{providerLabel}</strong>.</p>
      </header>

      {/* AI Personalization & Profile Section */}
      <section className="settings-section personalization-section" aria-labelledby="profile-title">
        <div className="settings-card-head">
          <span className="section-head-icon"><UserCheck size={22} aria-hidden="true" /></span>
          <div>
            <h2 id="profile-title">Personalize Verity AI</h2>
            <p>Customize how Verity interacts with you. Choose your preferred study tone, learning style, and custom instructions for all chats and summaries.</p>
          </div>
        </div>

        <div className="personalization-grid">
          <label className="field">
            <span>Your Name / Nickname</span>
            <input
              type="text"
              value={personalization.learnerName}
              onChange={(e) => savePersonalization({ learnerName: e.target.value })}
              placeholder="e.g. Alex, Sam, Doctor, Student"
              maxLength={60}
            />
            <small>Verity will address you naturally by this name.</small>
          </label>

          <label className="field">
            <span>AI Persona &amp; Tone</span>
            <select
              value={personalization.persona}
              onChange={(e) => savePersonalization({ persona: e.target.value as AiPersona })}
            >
              {Object.entries(PERSONA_DESCRIPTIONS).map(([key, info]) => (
                <option value={key} key={key}>{info.label}</option>
              ))}
            </select>
            <small>{PERSONA_DESCRIPTIONS[personalization.persona]?.tone}</small>
          </label>

          <label className="field">
            <span>Learning Style</span>
            <select
              value={personalization.learningStyle}
              onChange={(e) => savePersonalization({ learningStyle: e.target.value as LearningStyle })}
            >
              {Object.entries(LEARNING_STYLE_DESCRIPTIONS).map(([key, info]) => (
                <option value={key} key={key}>{info.label}</option>
              ))}
            </select>
            <small>{LEARNING_STYLE_DESCRIPTIONS[personalization.learningStyle]?.desc}</small>
          </label>

          <label className="field field--full">
            <span>Custom Instructions for Verity</span>
            <textarea
              rows={3}
              value={personalization.customInstructions}
              onChange={(e) => savePersonalization({ customInstructions: e.target.value })}
              placeholder="e.g. I am preparing for board exams. Always explain terms in simple terms first, then show mathematical formulas. Use bullet points."
              maxLength={1200}
            />
            <small>Special directions or background knowledge Verity should consider in every response.</small>
          </label>
        </div>

        {persSaved && (
          <div className="saved-badge-row">
            <span className="saved-badge"><Sparkles size={14} aria-hidden="true" /> Personalization saved to local profile</span>
          </div>
        )}
      </section>

      <section className="settings-section" aria-labelledby="ai-title">
        <div className="settings-card-head"><span><Cpu size={20} aria-hidden="true" /></span><div><h2 id="ai-title">AI backend</h2><p>Powers RAG search, summaries, podcasts, flashcards, and quizzes. Switching backends keeps your notes; use “Re-index all notes” below so semantic search uses the new embedding model.</p></div></div>
        <ProviderForm key={`${settings.provider}-${settings.model}-${settings.providerConsentAt ?? ""}`} boot={boot} mode="settings" onSaved={(next) => { onSettings(next); notify("AI backend saved."); }} />
      </section>

      <div className="settings-grid">
        <section className="settings-card" aria-labelledby="stt-title">
          <div className="settings-card-head"><span><Mic size={20} aria-hidden="true" /></span><div><h2 id="stt-title">Speech-to-text</h2><p>Audio uploads are transcribed on this PC with Whisper (Transformers.js + ONNX Runtime). Larger models are more accurate but slower.</p></div></div>
          <label className="field"><span>Whisper model</span>
            <select value={settings.sttModel} onChange={(event) => void update({ sttModel: event.target.value }, "Speech model updated.")}>
              {sttModels.map((model) => <option value={model} key={model}>{model.replace("Xenova/", "")} {model.endsWith("tiny") ? "(fastest, ~40 MB)" : model.endsWith("base") ? "(balanced, ~75 MB)" : "(most accurate, ~250 MB)"}</option>)}
            </select>
            <small>Downloaded once into {environment.dataDir}\models and reused offline.</small>
          </label>
        </section>

        <section className="settings-card" aria-labelledby="diag-title">
          <div className="settings-card-head"><span><ShieldCheck size={20} aria-hidden="true" /></span><div><h2 id="diag-title">Privacy &amp; diagnostics</h2><p>Verity AI has no analytics, tracking, or crash-upload endpoint. Diagnostics, if enabled, are written to a local file only.</p></div></div>
          <label className="toggle-row" htmlFor="diagnostics-setting">
            <span><strong>Local diagnostics log</strong><small>{environment.logPath}</small></span>
            <input id="diagnostics-setting" type="checkbox" role="switch" aria-checked={settings.diagnosticsOptIn} checked={settings.diagnosticsOptIn} onChange={(event) => void update({ diagnosticsOptIn: event.target.checked }, event.target.checked ? "Local diagnostics enabled." : "Diagnostics disabled.")} />
          </label>
          <p className="help-text">Privacy Policy accepted {settings.privacyConsentAt ? new Date(settings.privacyConsentAt).toLocaleString() : "—"}.{settings.providerConsentAt ? ` API transmission consent given ${new Date(settings.providerConsentAt).toLocaleString()}.` : ""}</p>
        </section>

        <section className="settings-card" aria-labelledby="theme-title">
          <div className="settings-card-head"><span><Palette size={20} aria-hidden="true" /></span><div><h2 id="theme-title">Appearance</h2><p>Catppuccin Mocha palette tested against WCAG 2.1 AA for text and controls.</p></div></div>
          <button type="button" className="theme-choice" onClick={() => void update({ theme: settings.theme === "dark" ? "light" : "dark" }, "Theme updated.")}>
            <span>{settings.theme === "dark" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}<span><strong>{settings.theme === "dark" ? "Catppuccin Mocha (Dark)" : "Light"} theme</strong><small>Switch to {settings.theme === "dark" ? "light" : "Catppuccin Mocha dark"} theme</small></span></span><ChevronRight size={18} aria-hidden="true" />
          </button>
        </section>

        <section className="settings-card" aria-labelledby="data-title">
          <div className="settings-card-head"><span><Database size={20} aria-hidden="true" /></span><div><h2 id="data-title">Data &amp; storage</h2><p>Notes, embeddings, chats, and generated study material never leave this folder unless you export them.</p></div></div>
          <dl className="data-grid">
            <div><dt>Data folder</dt><dd><code>{environment.dataDir}</code></dd></div>
            <div><dt>Database</dt><dd>{environment.database}</dd></div>
            <div><dt>Mode</dt><dd>{environment.desktop ? "Desktop (Electron)" : "Server / development"} · {environment.platform}</dd></div>
          </dl>
          <div className="button-row">
            <button type="button" className="secondary-button compact" onClick={reindexAll} disabled={busy === "reindex"}><RefreshCw size={15} aria-hidden="true" />{busy === "reindex" ? "Re-indexing…" : "Re-index all notes"}</button>
            <button type="button" className="secondary-button compact" onClick={() => downloadFile("/api/subjects?export=all&format=json")}><Download size={15} aria-hidden="true" />Export library (JSON)</button>
            <button type="button" className="secondary-button compact" onClick={() => downloadFile("/api/subjects?export=all&format=md")}><Download size={15} aria-hidden="true" />Export library (Markdown)</button>
          </div>
          <div className="danger-zone">
            <div><strong>Erase all local data</strong><small>Deletes every subject, note, index, chat, generated asset, and setting — including API keys.</small></div>
            <button type="button" className="secondary-button compact danger" onClick={() => setEraseOpen(true)}><Trash2 size={15} aria-hidden="true" />Erase…</button>
          </div>
        </section>

        <section className="settings-card settings-card--wide" aria-labelledby="about-title">
          <div className="settings-card-head"><span><Info size={20} aria-hidden="true" /></span><div><h2 id="about-title">About Verity AI</h2><p>Version {environment.version} · Local-first AI study workspace.</p></div></div>
          <dl className="data-grid about-grid">
            <div><dt>Publisher</dt><dd>{publisher.name}</dd></div>
            <div><dt>Legal entity</dt><dd>{publisher.legalEntity}</dd></div>
            <div><dt>Address</dt><dd>{publisher.address}</dd></div>
            <div><dt>Support</dt><dd><a href={`mailto:${publisher.supportEmail}`}>{publisher.supportEmail}</a></dd></div>
            <div><dt>Privacy requests</dt><dd><a href={`mailto:${publisher.privacyEmail}`}>{publisher.privacyEmail}</a></dd></div>
            <div><dt>Runtime</dt><dd>Node {environment.node} · {environment.platform}</dd></div>
          </dl>
          <InlineAlert tone="info">Publisher fields are read from build-time configuration (NEXT_PUBLIC_PUBLISHER_*). Distributors must supply verified business details and monitored contact addresses before release; the “.example” addresses shown in developer builds are non-deliverable placeholders.</InlineAlert>
          <nav className="settings-links" aria-label="Legal documents">
            <a href="/legal/privacy">Privacy Policy<ChevronRight size={16} aria-hidden="true" /></a>
            <a href="/legal/terms">Terms &amp; Conditions<ChevronRight size={16} aria-hidden="true" /></a>
            <a href="/legal/telemetry">Telemetry &amp; Diagnostics Policy<ChevronRight size={16} aria-hidden="true" /></a>
            <a href="/legal/license">License, Refunds &amp; Support<ChevronRight size={16} aria-hidden="true" /></a>
            <a href="/legal/accessibility"><span className="link-icon"><Accessibility size={15} aria-hidden="true" />Accessibility Statement</span><ChevronRight size={16} aria-hidden="true" /></a>
            <a href="/legal/licenses"><span className="link-icon"><HardDrive size={15} aria-hidden="true" />Open-source licenses</span><ChevronRight size={16} aria-hidden="true" /></a>
          </nav>
        </section>
      </div>

      <Modal open={eraseOpen} title="Erase all local data" description="This permanently deletes everything Verity AI stores on this computer and restarts setup." onClose={() => setEraseOpen(false)}>
        <form className="folder-form" onSubmit={erase}>
          <label className="field"><span>Type ERASE to confirm</span><input value={eraseText} onChange={(event) => setEraseText(event.target.value)} autoComplete="off" /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEraseOpen(false)}>Cancel</button><button type="submit" className="primary-button danger" disabled={eraseText !== "ERASE" || busy === "erase"}>{busy === "erase" ? "Erasing…" : "Erase everything"}</button></div>
        </form>
      </Modal>
    </main>
  );
}
