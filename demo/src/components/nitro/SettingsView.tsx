"use client";

import { Accessibility, Check, ChevronRight, Cpu, Database, Download, HardDrive, Info, Mic, Moon, Palette, RefreshCw, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, downloadFile, errorMessage } from "./client";
import { ProviderForm } from "./Onboarding";
import type { FontPreference, PublicSettings, SettingsResponse } from "./types";
import { InlineAlert, Modal } from "./ui";

export function SettingsView({ boot, onSettings, onReload, onTreeChanged, notify, font = "sans", onFontChange }: {
  boot: SettingsResponse;
  onSettings: (settings: PublicSettings) => void;
  onReload: () => Promise<unknown>;
  onTreeChanged: () => Promise<unknown>;
  notify: (text: string, tone?: "success" | "info" | "error") => void;
  font?: FontPreference;
  onFontChange: (font: FontPreference) => void;
}) {
  const { settings, environment, publisher, presets, sttModels } = boot;
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState("");
  const [busy, setBusy] = useState<"" | "reindex" | "erase">("");

  const update = async (patch: Record<string, unknown>, message: string) => {
    try {
      const data = await api<{ settings: PublicSettings }>("/api/settings", { method: "PUT", json: patch });
      onSettings(data.settings);
      document.documentElement.dataset.theme = data.settings.theme;
      if (typeof document !== "undefined") {
        document.body.dataset.theme = data.settings.theme;
        try {
          localStorage.setItem("verity_theme", data.settings.theme);
        } catch {}
      }
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
      <header><p className="eyebrow">Preferences, privacy &amp; legal</p><h1 id="settings-title">Settings</h1><p>Everything here is stored on this computer. Current backend: <strong>{providerLabel}</strong>.</p></header>

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
          <div className="settings-card-head"><span><ShieldCheck size={20} aria-hidden="true" /></span><div><h2 id="diag-title">Privacy &amp; diagnostics</h2><p>Verity has no analytics, tracking, or crash-upload endpoint. Diagnostics, if enabled, are written to a local file only.</p></div></div>
          <label className="toggle-row" htmlFor="diagnostics-setting">
            <span><strong>Local diagnostics log</strong><small>{environment.logPath}</small></span>
            <input id="diagnostics-setting" type="checkbox" role="switch" aria-checked={settings.diagnosticsOptIn} checked={settings.diagnosticsOptIn} onChange={(event) => void update({ diagnosticsOptIn: event.target.checked }, event.target.checked ? "Local diagnostics enabled." : "Diagnostics disabled.")} />
          </label>
          <p className="help-text">Privacy Policy accepted {settings.privacyConsentAt ? new Date(settings.privacyConsentAt).toLocaleString() : "—"}.{settings.providerConsentAt ? ` API transmission consent given ${new Date(settings.providerConsentAt).toLocaleString()}.` : ""}</p>
        </section>

        <section className="settings-card settings-card--wide" aria-labelledby="theme-title">
          <div className="settings-card-head"><span><Palette size={20} aria-hidden="true" /></span><div><h2 id="theme-title">Appearance &amp; Themes</h2><p>Catppuccin color palettes and high-legibility typography from the frontend workspace.</p></div></div>

          <div style={{ marginTop: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Catppuccin theme palette</span>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>Select your preferred theme flavor. Applied across the entire application.</p>
            <div className="theme-grid-selector" role="radiogroup" aria-label="Theme selection">
              {[
                { id: "mocha" as const, name: "Mocha (Dark)", accent: "#89b4fa", bg: "#1e1e2e", text: "#cdd6f4" },
                { id: "macchiato" as const, name: "Macchiato", accent: "#8aadf4", bg: "#24273a", text: "#cad3f5" },
                { id: "frappe" as const, name: "Frappé", accent: "#8caaee", bg: "#303446", text: "#c6d0f5" },
                { id: "latte" as const, name: "Latte (Light)", accent: "#1e66f5", bg: "#eff1f5", text: "#4c4f69" },
              ].map((th) => {
                const isSelected = settings.theme === th.id || (th.id === "mocha" && settings.theme === "dark") || (th.id === "latte" && settings.theme === "light");
                return (
                  <button
                    type="button"
                    key={th.id}
                    className={`theme-card-option ${isSelected ? "active" : ""}`}
                    onClick={() => void update({ theme: th.id }, `Theme updated to ${th.name}.`)}
                    style={{ backgroundColor: th.bg, color: th.text, border: isSelected ? "2px solid var(--violet)" : "2px solid var(--line)", outline: "none" }}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: th.accent, display: "inline-block" }} />
                        <strong style={{ fontSize: 12.5, color: th.text }}>{th.name}</strong>
                      </div>
                      {isSelected && <Check size={14} style={{ color: "var(--violet)", flexShrink: 0 }} aria-hidden="true" />}
                    </div>
                    <small style={{ fontSize: 10, opacity: 0.8, color: th.text }}>{isSelected ? "Active theme" : "Click to select"}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Typography Font</span>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>Choose a typography style suited for code, study, or accessibility.</p>
            <div className="font-grid-selector" role="radiogroup" aria-label="Font preference">
              {[
                { id: "sans" as const, label: "System Sans", preview: "Clean interface typography" },
                { id: "mono" as const, label: "Developer Monospace", preview: "const verity = true;" },
                { id: "dyslexic" as const, label: "High Legibility", preview: "Clear reading typography" },
              ].map((f) => {
                const isSelected = font === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    className={`font-card-option ${isSelected ? "active" : ""}`}
                    onClick={() => onFontChange(f.id)}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <strong style={{ fontSize: 12 }}>{f.label}</strong>
                      {isSelected && <Check size={14} style={{ color: "var(--violet)" }} aria-hidden="true" />}
                    </div>
                    <small style={{ fontSize: 10.5, color: "var(--muted)" }}>{f.preview}</small>
                  </button>
                );
              })}
            </div>
          </div>
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
          <div className="settings-card-head"><span><Info size={20} aria-hidden="true" /></span><div><h2 id="about-title">About Verity</h2><p>Version {environment.version} · Local-first AI study workspace for Windows.</p></div></div>
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

      <Modal open={eraseOpen} title="Erase all local data" description="This permanently deletes everything Verity stores on this computer and restarts setup." onClose={() => setEraseOpen(false)}>
        <form className="folder-form" onSubmit={erase}>
          <label className="field"><span>Type ERASE to confirm</span><input value={eraseText} onChange={(event) => setEraseText(event.target.value)} autoComplete="off" /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEraseOpen(false)}>Cancel</button><button type="submit" className="primary-button danger" disabled={eraseText !== "ERASE" || busy === "erase"}>{busy === "erase" ? "Erasing…" : "Erase everything"}</button></div>
        </form>
      </Modal>
    </main>
  );
}
