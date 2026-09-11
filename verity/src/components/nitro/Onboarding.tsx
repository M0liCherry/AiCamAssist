"use client";

import { ArrowRight, Check, Cloud, Cpu, Download, Eye, EyeOff, HardDrive, KeyRound, ListRestart, RefreshCw, ServerCog, ShieldCheck, Sparkles, Wifi, WifiOff } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, formatBytes } from "./client";
import type { Provider, PublicSettings, SettingsResponse } from "./types";
import { ConsentField, InlineAlert, ProgressBar, Spinner } from "./ui";

type OllamaStatus = { running: boolean; version?: string; models: { name: string; size: number; parameterSize?: string }[]; error?: string };
type PullState = { model: string; percent: number | null; label: string };
type ModelInfo = { id: string; label: string; recommended?: boolean };
type ModelCatalog = { chat: ModelInfo[]; embedding: ModelInfo[] };

const CUSTOM = "__custom";

const PROVIDER_ORDER: Exclude<Provider, "none">[] = ["gemini", "anthropic", "ollama", "llamacpp"];

export function ProviderForm({ boot, mode, onSaved, onSkip }: { boot: SettingsResponse; mode: "onboarding" | "settings"; onSaved: (settings: PublicSettings) => void; onSkip?: () => void }) {
  const { settings, presets } = boot;
  const initialProvider: Exclude<Provider, "none"> = settings.provider === "none" ? "gemini" : settings.provider;
  const [provider, setProvider] = useState<Exclude<Provider, "none">>(initialProvider);
  const [model, setModel] = useState(settings.provider === initialProvider && settings.model ? settings.model : presets[initialProvider].model);
  const [embeddingModel, setEmbeddingModel] = useState(settings.provider === initialProvider && settings.embeddingModel ? settings.embeddingModel : presets[initialProvider].embeddingModel);
  const [endpoint, setEndpoint] = useState(settings.provider === initialProvider && settings.endpoint ? settings.endpoint : presets[initialProvider].endpoint);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [consent, setConsent] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [pull, setPull] = useState<PullState | null>(null);
  const [customModel, setCustomModel] = useState("");
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<{ tone: "info" | "warning" | "error"; text: string } | null>(null);
  const customTyped = useRef(false);
  const autoLoaded = useRef<string>("");

  const preset = presets[provider];
  const keyStored = settings.hasApiKey && settings.provider === provider;
  const canListModels = provider !== "ollama" && (!preset.needsKey || apiKey.trim().length > 0 || keyStored);

  // Live catalog wins; the preset list is only a fallback until the provider has been queried.
  const chatOptions: ModelInfo[] = catalog?.chat.length ? catalog.chat : preset.models.map((id) => ({ id, label: id }));
  const embeddingOptions: ModelInfo[] = catalog ? catalog.embedding : preset.embeddingModels.map((id) => ({ id, label: id }));
  const modelChoices = chatOptions.some((m) => m.id === model) || !model ? chatOptions : [{ id: model, label: `${model} (saved)` }, ...chatOptions];
  const showEmbeddingField = embeddingOptions.length > 0;

  const choose = (next: Exclude<Provider, "none">) => {
    setProvider(next);
    const keepSaved = settings.provider === next;
    setModel(keepSaved && settings.model ? settings.model : presets[next].model);
    setEmbeddingModel(keepSaved && settings.embeddingModel ? settings.embeddingModel : presets[next].embeddingModel);
    setEndpoint(keepSaved && settings.endpoint ? settings.endpoint : presets[next].endpoint);
    setTestResult(null);
    setError("");
    setConsent(false);
    setCatalog(null);
    setCatalogNotice(null);
    customTyped.current = false;
  };

  /** Asks the provider which models this key/runtime can use and auto-corrects a retired selection. */
  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    setCatalogNotice(null);
    try {
      const result = await api<ModelCatalog>("/api/ai", { method: "POST", json: { action: "list-models", draft: { provider, model, embeddingModel, endpoint, apiKey } } });
      setCatalog(result);
      if (!result.chat.length) {
        setCatalogNotice({ tone: "warning", text: "The provider returned no text models for this key. Check the key's project permissions." });
        return;
      }
      const recommended = result.chat.find((m) => m.recommended) ?? result.chat[0];
      const currentAvailable = result.chat.some((m) => m.id === model);
      if (!currentAvailable && !customTyped.current) {
        setModel(recommended.id);
        setCatalogNotice({ tone: "info", text: `${model || "The default model"} isn't available to this key, so ${recommended.id} (recommended) was selected. Save to apply.` });
      } else {
        setCatalogNotice({ tone: "info", text: `${result.chat.length} model${result.chat.length === 1 ? "" : "s"} available to this key${recommended ? ` · recommended: ${recommended.id}` : ""}.` });
      }
      if (result.embedding.length && !result.embedding.some((m) => m.id === embeddingModel)) {
        setEmbeddingModel((result.embedding.find((m) => m.recommended) ?? result.embedding[0]).id);
      }
    } catch (err) {
      setCatalogNotice({ tone: "error", text: errorMessage(err) });
    } finally {
      setLoadingModels(false);
    }
  }, [provider, model, embeddingModel, endpoint, apiKey]);

  // Auto-load once when a key is already stored (or a local server is selected) so stale saved models get flagged immediately.
  useEffect(() => {
    if (provider === "ollama" || autoLoaded.current === provider) return;
    if (keyStored || (!preset.needsKey && provider === "llamacpp")) {
      autoLoaded.current = provider;
      void loadModels();
    }
  }, [provider, keyStored, preset.needsKey, loadModels]);

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true);
    try {
      setOllama(await api<OllamaStatus>("/api/ai", { method: "POST", json: { action: "ollama-status", endpoint } }));
    } catch (err) {
      setOllama({ running: false, models: [], error: errorMessage(err) });
    } finally {
      setCheckingOllama(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (provider === "ollama") void checkOllama();
  }, [provider, checkOllama]);

  const downloadModel = async (name: string) => {
    setError("");
    setPull({ model: name, percent: null, label: "Contacting Ollama…" });
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ollama-pull", endpoint, model: name }) });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Download failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (; ;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { status?: string; total?: number; completed?: number; error?: string };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.error) throw new Error(event.error);
          const percent = event.total ? Math.round(((event.completed ?? 0) / event.total) * 100) : null;
          setPull({ model: name, percent, label: event.status ?? "Downloading…" });
        }
      }
      setPull({ model: name, percent: 100, label: "Download complete" });
      setModel(name);
      await checkOllama();
    } catch (err) {
      setError(errorMessage(err, "The model download failed."));
    } finally {
      setTimeout(() => setPull(null), 1500);
    }
  };

  const draft = () => ({ provider, model, embeddingModel, endpoint, apiKey });

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const result = await api<{ ok: boolean; detail: string }>("/api/ai", { method: "POST", json: { action: "test", draft: draft() } });
      setTestResult({ ok: true, text: result.detail });
    } catch (err) {
      setTestResult({ ok: false, text: errorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (preset.needsKey && !apiKey && !keyStored) return setError(`Enter your ${preset.shortLabel} API key.`);
    if (!preset.local && !consent && (settings.provider !== provider || apiKey)) return setError("Please confirm the data-transmission notice to continue.");
    setSaving(true);
    try {
      const data = await api<{ settings: PublicSettings }>("/api/settings", { method: "PUT", json: { ...draft(), providerConsent: consent || undefined } });
      onSaved(data.settings);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="provider-form" onSubmit={save} aria-label="AI backend configuration">
      <div className="provider-grid" role="radiogroup" aria-label="Inference backend">
        {PROVIDER_ORDER.map((key) => {
          const item = presets[key];
          const selected = provider === key;
          return (
            <button type="button" role="radio" aria-checked={selected} className={`provider-card ${selected ? "selected" : ""}`} key={key} onClick={() => choose(key)}>
              <span className="provider-icon" aria-hidden="true">{item.local ? (key === "ollama" ? <Cpu size={20} /> : <ServerCog size={20} />) : <Cloud size={20} />}</span>
              <span className="provider-copy">
                <strong>{item.label}</strong>
                <small>{item.local ? "Runs on this PC · offline" : "API key · data sent to provider"}</small>
              </span>
              {selected && <Check size={16} className="provider-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="help-text">{preset.description}</p>

      <div className="provider-fields">
        {preset.needsKey && (
          <label className="field">
            <span>{preset.shortLabel} API key {keyStored && <em>Saved ({settings.apiKeyHint}) — leave blank to keep</em>}</span>
            <span className="key-input">
              <KeyRound size={16} aria-hidden="true" />
              <input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setCatalog(null); setCatalogNotice(null); }} onBlur={() => { if (apiKey.trim().length > 12 && !catalog) void loadModels(); }} autoComplete="off" spellCheck={false} placeholder={keyStored ? "Enter a new key to replace the saved one" : "Paste your API key"} aria-describedby="key-help" />
              <button type="button" className="icon-button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Hide API key" : "Show API key"} aria-pressed={showKey}>{showKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
            </span>
            <small id="key-help">Keys are encrypted with AES-256-GCM and stored only in your local VerityAI data folder. Get a key at <a href={preset.keyUrl} target="_blank" rel="noreferrer">{preset.keyUrl.replace(/^https?:\/\//, "")}<span className="sr-only"> (opens in a new tab)</span></a>.</small>
          </label>
        )}

        {preset.local && (
          <label className="field">
            <span>Local endpoint</span>
            <input type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={preset.endpoint} />
            <small>{provider === "ollama" ? "Ollama listens on http://127.0.0.1:11434 by default." : "Start llama-server or LM Studio's local server and paste its base URL."}</small>
          </label>
        )}

        {provider === "ollama" && (
          <section className="ollama-panel" aria-live="polite">
            <div className="ollama-status">
              <span className={`status-dot ${ollama?.running ? "ok" : "bad"}`} aria-hidden="true" />
              <span>{checkingOllama ? "Checking Ollama…" : ollama?.running ? `Ollama ${ollama.version ?? ""} is running · ${ollama.models.length} model${ollama.models.length === 1 ? "" : "s"} installed` : ollama?.error ?? "Ollama not detected"}</span>
              <button type="button" className="text-button" onClick={checkOllama} disabled={checkingOllama}><RefreshCw size={14} aria-hidden="true" />Re-check</button>
            </div>
            {ollama && !ollama.running && (
              <InlineAlert tone="warning">Install Ollama from <a href={preset.keyUrl} target="_blank" rel="noreferrer">ollama.com/download</a>, open it, then re-check. VerityAI never sends data outside this PC when Ollama is selected.</InlineAlert>
            )}
            {ollama?.running && ollama.models.length > 0 && (
              <div className="model-list" aria-label="Installed models">
                {ollama.models.map((item) => (
                  <button type="button" key={item.name} className={`model-chip ${item.name === model ? "active" : ""}`} onClick={() => setModel(item.name)} aria-pressed={item.name === model}>
                    <HardDrive size={13} aria-hidden="true" />{item.name}<small>{item.parameterSize ?? formatBytes(item.size)}</small>
                  </button>
                ))}
              </div>
            )}
            {pull && (
              <div className="pull-progress">
                <span><Download size={14} aria-hidden="true" /> {pull.model}: {pull.label}{pull.percent !== null ? ` · ${pull.percent}%` : ""}</span>
                <ProgressBar value={pull.percent} label={`Downloading ${pull.model}`} />
              </div>
            )}
          </section>
        )}

        {provider !== "ollama" && (
          <div className="catalog-row">
            <button type="button" className="secondary-button compact" onClick={loadModels} disabled={!canListModels || loadingModels}>
              {loadingModels ? <Spinner label="Loading models" /> : <><ListRestart size={15} aria-hidden="true" />{catalog ? "Reload available models" : "Load available models"}</>}
            </button>
            <small>{catalog ? "Showing the live list from the provider." : preset.needsKey ? "Enter your key, then load the models it can use — provider lists change often." : "Lists the models served at the endpoint above."}</small>
          </div>
        )}
        {catalogNotice && <InlineAlert tone={catalogNotice.tone}>{catalogNotice.text}</InlineAlert>}

        <div className="field-row">
          <label className="field">
            <span>Model {catalog?.chat.length ? <em>live list</em> : preset.models.length ? <em>built-in list</em> : null}</span>
            {modelChoices.length ? (
              <select value={modelChoices.some((m) => m.id === model) ? model : CUSTOM} onChange={(event) => { if (event.target.value === CUSTOM) { customTyped.current = true; setModel(customModel || ""); } else { customTyped.current = false; setModel(event.target.value); } }}>
                {modelChoices.map((item) => <option value={item.id} key={item.id}>{item.label}{item.recommended ? " — recommended" : ""}</option>)}
                <option value={CUSTOM}>Custom model name…</option>
              </select>
            ) : (
              <input value={model} onChange={(event) => { customTyped.current = true; setModel(event.target.value); }} placeholder="Model id exposed by the server" />
            )}
          </label>
          {modelChoices.length > 0 && !modelChoices.some((m) => m.id === model) && (
            <label className="field">
              <span>Custom model id</span>
              <input value={model} onChange={(event) => { customTyped.current = true; setModel(event.target.value); setCustomModel(event.target.value); }} placeholder={provider === "ollama" ? "e.g. qwen3:14b" : provider === "gemini" ? "e.g. gemini-3.8-flash" : "e.g. claude-sonnet-4-6"} />
            </label>
          )}
          {showEmbeddingField && (
            <label className="field">
              <span>Embedding model</span>
              <select value={embeddingOptions.some((m) => m.id === embeddingModel) ? embeddingModel : embeddingOptions[0].id} onChange={(event) => setEmbeddingModel(event.target.value)}>
                {embeddingOptions.map((item) => <option value={item.id} key={item.id}>{item.label}{item.recommended ? " — recommended" : ""}</option>)}
              </select>
              <small>Used for semantic search over your notes.</small>
            </label>
          )}
        </div>

        {provider === "ollama" && ollama?.running && (
          <div className="download-row">
            {!ollama.models.some((m) => m.name.replace(/:latest$/, "") === model.replace(/:latest$/, "")) && model && (
              <button type="button" className="secondary-button compact" onClick={() => downloadModel(model)} disabled={Boolean(pull)}><Download size={15} aria-hidden="true" />Download {model}</button>
            )}
            {embeddingModel && !ollama.models.some((m) => m.name.replace(/:latest$/, "") === embeddingModel.replace(/:latest$/, "")) && (
              <button type="button" className="secondary-button compact" onClick={() => downloadModel(embeddingModel)} disabled={Boolean(pull)}><Download size={15} aria-hidden="true" />Download {embeddingModel} (embeddings)</button>
            )}
          </div>
        )}

        {!preset.local && (
          <ConsentField id="provider-consent" checked={consent} onChange={setConsent}>
            I understand that when I use AI features, the text of the selected notes and my questions is transmitted to {preset.label} under my own API key and handled under their terms. Nothing is sent until I trigger an AI action. See the <a href="/legal/privacy" target="_blank">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a>.
          </ConsentField>
        )}
        {preset.local && (
          <p className="help-text local-note"><ShieldCheck size={14} aria-hidden="true" /> Local backend: prompts, notes, and embeddings stay on this computer.</p>
        )}
      </div>

      {testResult && <InlineAlert tone={testResult.ok ? "success" : "error"}>{testResult.text}</InlineAlert>}
      {error && <InlineAlert tone="error">{error}</InlineAlert>}

      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={test} disabled={testing || saving}>
          {testing ? <Spinner label="Testing connection" /> : <>{preset.local ? <Wifi size={15} aria-hidden="true" /> : <Cloud size={15} aria-hidden="true" />}Test connection</>}
        </button>
        <div className="form-actions-right">
          {onSkip && <button type="button" className="text-button" onClick={onSkip}><WifiOff size={14} aria-hidden="true" />Set up later</button>}
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : mode === "onboarding" ? "Save and continue" : "Save AI backend"}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </div>
    </form>
  );
}

export function Onboarding({ boot, onComplete }: { boot: SettingsResponse; onComplete: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [configured, setConfigured] = useState<PublicSettings | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const steps = ["Welcome", "AI backend", "Diagnostics", "Ready"];

  const finish = async () => {
    setFinishing(true);
    setError("");
    try {
      await api("/api/settings", { method: "PUT", json: { onboardingComplete: true, privacyConsent: true, diagnosticsOptIn: diagnostics } });
      await onComplete();
    } catch (err) {
      setError(errorMessage(err));
      setFinishing(false);
    }
  };

  return (
    <main className="onboarding" aria-labelledby="onboarding-title">
      <section className="onboarding-card">
        <header className="onboarding-head">
          <span className="hero-mark" aria-hidden="true"><Sparkles size={22} /></span>
          <div>
            <p className="eyebrow">First launch · v{boot.environment.version}</p>
            <h1 id="onboarding-title">{steps[step] === "Welcome" ? "Welcome to VerityAI" : steps[step]}</h1>
          </div>
        </header>
        <ol className="onboarding-steps" aria-label="Setup progress">
          {steps.map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined} className={index < step ? "done" : index === step ? "current" : ""}>
              <span aria-hidden="true">{index < step ? <Check size={13} /> : index + 1}</span>{label}
            </li>
          ))}
        </ol>

        <div className="onboarding-body">
          {step === 0 && (
            <>
              <p className="lead">VerityAI is a local-first study workspace. Your notes, collections, embeddings, transcripts, and generated study material are stored on this computer in <code>{boot.environment.dataDir}</code>.</p>
              <ul className="feature-list">
                <li><HardDrive size={17} aria-hidden="true" /><span><strong>Everything stays local by default.</strong> There is no VerityAI account, cloud sync, or telemetry endpoint.</span></li>
                <li><Cpu size={17} aria-hidden="true" /><span><strong>You choose the AI engine.</strong> Bring a Gemini or Claude key, or run Qwen and other GGUF models fully offline with Ollama or llama.cpp.</span></li>
                <li><ShieldCheck size={17} aria-hidden="true" /><span><strong>Explicit consent for any transmission.</strong> Note text leaves this PC only when you pick a cloud provider and trigger an AI action.</span></li>
              </ul>
              <ConsentField id="privacy-consent" checked={privacyConsent} onChange={setPrivacyConsent}>
                I have read and agree to the <a href="/legal/privacy" target="_blank">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a> and <a href="/legal/terms" target="_blank">Terms &amp; Conditions<span className="sr-only"> (opens in a new tab)</span></a>, including the notice that AI output can be inaccurate.
              </ConsentField>
              <div className="onboarding-actions">
                <button type="button" className="primary-button" disabled={!privacyConsent} onClick={() => setStep(1)}>Continue<ArrowRight size={16} aria-hidden="true" /></button>
              </div>
            </>
          )}
          {step === 1 && <ProviderForm boot={boot} mode="onboarding" onSaved={(saved) => { setConfigured(saved); setStep(2); }} onSkip={() => setStep(2)} />}
          {step === 2 && (
            <>
              <p className="lead">Crash and error diagnostics are <strong>off by default</strong>. If you opt in, VerityAI appends error details to a log file on this computer so you can attach it to a support request. Nothing is uploaded automatically.</p>
              <label className="toggle-row" htmlFor="diagnostics-toggle">
                <span><strong>Local diagnostics log</strong><small>{boot.environment.logPath}</small></span>
                <input id="diagnostics-toggle" type="checkbox" role="switch" aria-checked={diagnostics} checked={diagnostics} onChange={(event) => setDiagnostics(event.target.checked)} />
              </label>
              <p className="help-text">You can change this any time in Settings → Privacy. Read the <a href="/legal/telemetry" target="_blank">Telemetry Policy<span className="sr-only"> (opens in a new tab)</span></a>.</p>
              <div className="onboarding-actions">
                <button type="button" className="text-button" onClick={() => setStep(1)}>Back</button>
                <button type="button" className="primary-button" onClick={() => setStep(3)}>Continue<ArrowRight size={16} aria-hidden="true" /></button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <dl className="summary-list">
                <div><dt>AI backend</dt><dd>{configured && configured.provider !== "none" ? `${boot.presets[configured.provider].label} · ${configured.model}` : "Not configured yet — notes and imports work; AI tools will prompt you to connect a backend."}</dd></div>
                <div><dt>Data location</dt><dd>{boot.environment.dataDir}</dd></div>
                <div><dt>Diagnostics</dt><dd>{diagnostics ? "Local log enabled (never uploaded)" : "Off"}</dd></div>
              </dl>
              {error && <InlineAlert tone="error">{error}</InlineAlert>}
              <div className="onboarding-actions">
                <button type="button" className="text-button" onClick={() => setStep(2)}>Back</button>
                <button type="button" className="primary-button" onClick={finish} disabled={finishing}>{finishing ? "Opening workspace…" : "Open VerityAI"}<ArrowRight size={16} aria-hidden="true" /></button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
