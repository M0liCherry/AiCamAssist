"use client";

import { Accessibility, Check, ChevronRight, Cloud, Cpu, Database, Download, Eye, EyeOff, HardDrive, Headphones, Info, Mic, Moon, Palette, Radio, RefreshCw, ShieldCheck, Sparkles, Sun, Trash2, UserCheck, Wand2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
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

  const [elevenKeyInput, setElevenKeyInput] = useState("");
  const [showElevenKey, setShowElevenKey] = useState(false);
  const [testingEleven, setTestingEleven] = useState(false);
  const [elevenTestResult, setElevenTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [designingVoice, setDesigningVoice] = useState<"host" | "guest" | null>(null);
  const [designNotice, setDesignNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [kokoEndpointInput, setKokoEndpointInput] = useState(settings.kokoCloneEndpoint || "http://127.0.0.1:7860");
  const [testingKoko, setTestingKoko] = useState(false);
  const [kokoTestResult, setKokoTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [voices, setVoices] = useState<Array<{ id: string; name: string; category?: string; description?: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const loadElevenVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const res = await api<{ voices: Array<{ id: string; name: string; category?: string; description?: string }> }>("/api/podcast/voices");
      if (res?.voices?.length) setVoices(res.voices);
    } catch {
      // Keep fallbacks
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  useEffect(() => {
    void loadElevenVoices();
  }, [loadElevenVoices]);

  const testElevenConnection = async () => {
    setTestingEleven(true);
    setElevenTestResult(null);
    try {
      const res = await api<{ valid: boolean; tier?: string }>("/api/podcast/voices", {
        method: "POST",
        json: { action: "test-elevenlabs", apiKey: elevenKeyInput.trim() || undefined },
      });
      setElevenTestResult({ ok: true, text: `ElevenLabs verified (${res.tier || "active"} tier)!` });
    } catch (err) {
      setElevenTestResult({ ok: false, text: errorMessage(err) });
    } finally {
      setTestingEleven(false);
    }
  };

  const saveElevenKey = async () => {
    if (!elevenKeyInput.trim()) return;
    await update({ elevenLabsApiKey: elevenKeyInput.trim(), podcastAudioEngine: "elevenlabs" }, "ElevenLabs API key saved.");
    setElevenKeyInput("");
    setElevenTestResult(null);
    void loadElevenVoices();
  };

  const clearElevenKey = async () => {
    await update({ clearElevenLabsApiKey: true }, "ElevenLabs API key removed.");
    setElevenKeyInput("");
    setElevenTestResult(null);
  };

  const testKokoConnection = async () => {
    setTestingKoko(true);
    setKokoTestResult(null);
    try {
      const res = await api<{ running: boolean; error?: string }>("/api/podcast/voices", {
        method: "POST",
        json: { action: "test-kokoclone", endpoint: kokoEndpointInput.trim() },
      });
      if (res.running) {
        setKokoTestResult({ ok: true, text: `KokoClone server is online and responding at ${kokoEndpointInput}!` });
      } else {
        setKokoTestResult({ ok: false, text: `KokoClone server unreachable at ${kokoEndpointInput}. ${res.error || "Make sure python app.py is running."}` });
      }
    } catch (err) {
      setKokoTestResult({ ok: false, text: errorMessage(err) });
    } finally {
      setTestingKoko(false);
    }
  };

  const saveKokoEndpoint = async () => {
    await update({ kokoCloneEndpoint: kokoEndpointInput.trim() }, "KokoClone endpoint saved.");
  };

  const designVoiceFromProfile = async (role: "host" | "guest") => {
    setDesigningVoice(role);
    setDesignNotice(null);
    try {
      const res = await api<{ voiceId: string; voiceName: string; message: string }>("/api/podcast/voices", {
        method: "POST",
        json: {
          action: "design-from-personalization",
          personaLabel: PERSONA_DESCRIPTIONS[personalization.persona]?.label || "Friendly",
          personaTone: PERSONA_DESCRIPTIONS[personalization.persona]?.tone || "Warm and supportive",
          learningStyleDesc: LEARNING_STYLE_DESCRIPTIONS[personalization.learningStyle]?.desc || "Visual and structured",
          learnerName: personalization.learnerName,
          customInstructions: personalization.customInstructions,
          role,
        },
      });
      const patch = role === "host" ? { elevenLabsHostVoice: res.voiceId } : { elevenLabsGuestVoice: res.voiceId };
      await update(patch, `${role === "host" ? "Host" : "Guest"} voice designed from your profile!`);
      setDesignNotice({ tone: "success", text: `${res.message} Selected as ${role === "host" ? "Speaker 1 (Host)" : "Speaker 2 (Guest)"}.` });
      void loadElevenVoices();
    } catch (err) {
      setDesignNotice({ tone: "error", text: errorMessage(err) });
    } finally {
      setDesigningVoice(null);
    }
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

      {/* Podcast Voices & Voice Cloning Section */}
      <section className="settings-section podcast-settings-section" aria-labelledby="podcast-audio-title">
        <div className="settings-card-head">
          <span><Headphones size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="podcast-audio-title">Podcast Audio &amp; Voice Cloning</h2>
            <p>Generate high-fidelity conversational audio for podcasts. Use free system speech, ElevenLabs studio AI voices, or KokoClone zero-shot voice cloning.</p>
          </div>
        </div>

        <div className="personalization-grid" style={{ marginBottom: 18 }}>
          <label className="field field--full">
            <span>Default Podcast Audio Engine</span>
            <div className="provider-grid" style={{ marginTop: 6 }}>
              <button
                type="button"
                className={`provider-card ${settings.podcastAudioEngine === "speechSynthesis" ? "selected" : ""}`}
                onClick={() => void update({ podcastAudioEngine: "speechSynthesis" }, "Default voice set to System Speech.")}
              >
                <span className="card-radio" aria-hidden="true">{settings.podcastAudioEngine === "speechSynthesis" ? <Check size={12} /> : null}</span>
                <strong>System Speech (OS Voices)</strong>
                <p>Free, fast, 100% offline via browser speech synthesis.</p>
              </button>

              <button
                type="button"
                className={`provider-card ${settings.podcastAudioEngine === "elevenlabs" ? "selected" : ""}`}
                onClick={() => void update({ podcastAudioEngine: "elevenlabs" }, "Default voice set to ElevenLabs.")}
              >
                <span className="card-radio" aria-hidden="true">{settings.podcastAudioEngine === "elevenlabs" ? <Check size={12} /> : null}</span>
                <strong>ElevenLabs AI Studio</strong>
                <p>Human-quality voices, personalized voice design from your profile, and instant voice cloning.</p>
              </button>

              <button
                type="button"
                className={`provider-card ${settings.podcastAudioEngine === "kokoclone" ? "selected" : ""}`}
                onClick={() => void update({ podcastAudioEngine: "kokoclone" }, "Default voice set to KokoClone.")}
              >
                <span className="card-radio" aria-hidden="true">{settings.podcastAudioEngine === "kokoclone" ? <Check size={12} /> : null}</span>
                <strong>KokoClone (Local Cloner)</strong>
                <p>Zero-shot voice cloning with your reference audio on local Kokoro-ONNX server.</p>
              </button>
            </div>
          </label>
        </div>

        {/* ElevenLabs Configuration */}
        <div className="settings-subsection" style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <Cloud size={16} /> ElevenLabs Configuration
            </h3>
            {settings.hasElevenLabsKey ? (
              <span className="status-pill status-pill--green">
                <strong>Active</strong> Key: {settings.elevenLabsKeyHint}
              </span>
            ) : (
              <span className="status-pill status-pill--amber">Not configured</span>
            )}
          </div>

          <div className="personalization-grid">
            <label className="field">
              <span>{settings.hasElevenLabsKey ? "Replace ElevenLabs API Key" : "ElevenLabs API Key"}</span>
              <div className="password-wrap">
                <input
                  type={showElevenKey ? "text" : "password"}
                  value={elevenKeyInput}
                  onChange={(e) => setElevenKeyInput(e.target.value)}
                  placeholder={settings.hasElevenLabsKey ? "Enter new key to update" : "xi-api-key or paste key here"}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowElevenKey((s) => !s)}
                  aria-label={showElevenKey ? "Hide key" : "Show key"}
                >
                  {showElevenKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small>Stored securely encrypted on your local PC in local.key.</small>
            </label>

            <div className="field" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {elevenKeyInput.trim().length > 0 && (
                  <button type="button" className="primary-button compact" onClick={saveElevenKey}>
                    Save Key
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={testElevenConnection}
                  disabled={testingEleven || (!elevenKeyInput.trim() && !settings.hasElevenLabsKey)}
                >
                  {testingEleven ? "Verifying…" : "Test Connection"}
                </button>
                {settings.hasElevenLabsKey && (
                  <button type="button" className="text-button compact" onClick={clearElevenKey}>
                    Remove Key
                  </button>
                )}
              </div>
            </div>
          </div>

          {elevenTestResult && (
            <div style={{ marginTop: 10 }}>
              <InlineAlert tone={elevenTestResult.ok ? "success" : "error"}>
                {elevenTestResult.text}
              </InlineAlert>
            </div>
          )}

          {/* Voice Selection & Personalized Voice Creator */}
          <div className="personalization-grid" style={{ marginTop: 16 }}>
            <label className="field">
              <span>Speaker 1 (Host Voice)</span>
              <select
                value={settings.elevenLabsHostVoice}
                onChange={(e) => void update({ elevenLabsHostVoice: e.target.value }, "Host voice updated.")}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.description ? `— ${v.description}` : `(${v.category || "custom"})`}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => void designVoiceFromProfile("host")}
                  disabled={Boolean(designingVoice) || !settings.hasElevenLabsKey}
                  title="Creates a personalized host voice on ElevenLabs matching your active persona and learning style"
                >
                  <Wand2 size={13} />
                  {designingVoice === "host" ? "Designing voice…" : "Design Host Voice from AI Profile"}
                </button>
              </div>
            </label>

            <label className="field">
              <span>Speaker 2 (Guest Voice)</span>
              <select
                value={settings.elevenLabsGuestVoice}
                onChange={(e) => void update({ elevenLabsGuestVoice: e.target.value }, "Guest voice updated.")}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.description ? `— ${v.description}` : `(${v.category || "custom"})`}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => void designVoiceFromProfile("guest")}
                  disabled={Boolean(designingVoice) || !settings.hasElevenLabsKey}
                  title="Creates a personalized guest voice on ElevenLabs matching your active persona and learning style"
                >
                  <Wand2 size={13} />
                  {designingVoice === "guest" ? "Designing voice…" : "Design Guest Voice from AI Profile"}
                </button>
              </div>
            </label>
          </div>

          {designNotice && (
            <div style={{ marginTop: 10 }}>
              <InlineAlert tone={designNotice.tone}>{designNotice.text}</InlineAlert>
            </div>
          )}
        </div>

        {/* KokoClone Configuration */}
        <div className="settings-subsection" style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <Radio size={16} /> KokoClone Voice Cloning (Local)
            </h3>
            <span className="status-pill status-pill--blue">Kokoro-ONNX + Kanade</span>
          </div>

          <div className="personalization-grid">
            <label className="field">
              <span>KokoClone Server Endpoint</span>
              <input
                type="url"
                value={kokoEndpointInput}
                onChange={(e) => setKokoEndpointInput(e.target.value)}
                placeholder="http://127.0.0.1:7860"
              />
              <small>Default Gradio/FastAPI server port is 7860.</small>
            </label>

            <div className="field" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kokoEndpointInput !== settings.kokoCloneEndpoint && (
                  <button type="button" className="primary-button compact" onClick={saveKokoEndpoint}>
                    Save Endpoint
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={testKokoConnection}
                  disabled={testingKoko}
                >
                  {testingKoko ? "Testing…" : "Test Endpoint"}
                </button>
              </div>
            </div>
          </div>

          {kokoTestResult && (
            <div style={{ marginTop: 10 }}>
              <InlineAlert tone={kokoTestResult.ok ? "success" : "error"}>
                {kokoTestResult.text}
              </InlineAlert>
            </div>
          )}

          <p className="help-text" style={{ marginTop: 10 }}>
            To run KokoClone locally: clone <code>https://github.com/Ashish-Patnaik/kokoclone</code> and run <code>python app.py</code>. When active, you can provide any 3–10 second reference audio clip (.wav or .mp3) directly in the Podcast player to clone the voice.
          </p>
        </div>
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
