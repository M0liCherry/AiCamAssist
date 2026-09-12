"use client";

import { FileCheck2, FileText, Headphones, Layers3, LayoutDashboard, ListChecks, Menu, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings, Sun, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, describeScope, errorMessage } from "./client";
import { Dashboard } from "./Dashboard";
import { EditorView } from "./EditorView";
import { Onboarding } from "./Onboarding";
import { SettingsView } from "./SettingsView";
import { FlashcardsView, PodcastsView, QuizzesView } from "./StudyViews";
import type { PublicSettings, Scope, SettingsResponse, Subject, ToastMessage, WorkspaceView } from "./types";

const NAV: { id: WorkspaceView; label: string; icon: typeof FileText }[] = [
  { id: "hub", label: "Notes hub", icon: LayoutDashboard },
  { id: "editor", label: "Document editor", icon: FileText },
  { id: "podcasts", label: "Podcasts", icon: Headphones },
  { id: "flashcards", label: "Flashcards", icon: Layers3 },
  { id: "quizzes", label: "Quizzes", icon: ListChecks },
];

function applyTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
}

export function NitroApp() {
  const [boot, setBoot] = useState<SettingsResponse | null>(null);
  const [bootError, setBootError] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scope, setScope] = useState<Scope | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [view, setView] = useState<WorkspaceView>("hub");
  const [collapsed, setCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: ToastMessage["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const loadSettings = useCallback(async () => {
    const data = await api<SettingsResponse>("/api/settings");
    setBoot(data);
    applyTheme(data.settings.theme);
    return data;
  }, []);

  const loadTree = useCallback(async () => {
    const data = await api<{ subjects: Subject[] }>("/api/subjects");
    setSubjects(data.subjects);
    return data.subjects;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadSettings(), loadTree()]);
      } catch (error) {
        setBootError(errorMessage(error, "VerityAI could not start."));
      }
    })();
  }, [loadSettings, loadTree]);

  // Child views can change the backend (e.g. "switch to the recommended model"); refresh the shell state.
  useEffect(() => {
    const onChanged = () => {
      loadSettings()
        .then((data) => notify(`AI backend updated: ${data.settings.provider !== "none" ? `${data.presets[data.settings.provider].shortLabel} · ${data.settings.model}` : "none"}`, "info"))
        .catch(() => undefined);
    };
    window.addEventListener("nitro:settings-changed", onChanged);
    return () => window.removeEventListener("nitro:settings-changed", onChanged);
  }, [loadSettings, notify]);

  useEffect(() => {
    if (!subjects.length) {
      if (scope) setScope(null);
      return;
    }
    const valid = scope && (scope.scopeType === "subject" ? subjects.some((s) => s.id === scope.scopeId) : subjects.some((s) => s.chapters.some((c) => c.id === scope.scopeId)));
    if (!valid) {
      const first = subjects[0];
      setScope(first.chapters[0] ? { scopeType: "chapter", scopeId: first.chapters[0].id } : { scopeType: "subject", scopeId: first.id });
    }
  }, [subjects, scope]);

  const scopeInfo = useMemo(() => describeScope(subjects, scope), [subjects, scope]);
  const settings = boot?.settings;
  const aiReady = Boolean(settings && settings.provider !== "none");
  const providerName = settings && settings.provider !== "none" ? `${boot!.presets[settings.provider].shortLabel} · ${settings.model}` : "No AI backend";

  const updateSettings = useCallback(
    async (patch: Record<string, unknown>) => {
      const data = await api<{ settings: PublicSettings }>("/api/settings", { method: "PUT", json: patch });
      setBoot((current) => (current ? { ...current, settings: data.settings } : current));
      applyTheme(data.settings.theme);
      return data.settings;
    },
    [],
  );

  const toggleTheme = async () => {
    if (!settings) return;
    const next = settings.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      await updateSettings({ theme: next });
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  const openNote = (noteId: number, chapterId: number) => {
    setActiveNoteId(noteId);
    setScope({ scopeType: "chapter", scopeId: chapterId });
    setView("editor");
  };

  if (bootError) {
    return (
      <main className="boot-screen">
        <div className="boot-card" role="alert">
          <img src="/logo.png" alt="Verity AI" className="hero-logo-img" />
          <h1>Verity AI could not start</h1>
          <p>{bootError}</p>
          <p className="help-text">The local database service may still be starting. Check the desktop log in your data folder if this persists.</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}><RefreshCw size={15} aria-hidden="true" />Retry</button>
        </div>
      </main>
    );
  }
  if (!boot || !settings) {
    return (
      <main className="boot-screen" aria-busy="true">
        <div className="boot-card" role="status"><img src="/logo.png" alt="Verity AI" className="hero-logo-img pulse" /><p>Starting Verity AI…</p></div>
      </main>
    );
  }
  if (!settings.onboardingComplete) {
    return <Onboarding boot={boot} onComplete={async () => { await loadSettings(); }} />;
  }

  const renderView = () => {
    switch (view) {
      case "hub":
        return <Dashboard subjects={subjects} scope={scope} onScope={setScope} onOpenNote={openNote} onTreeChanged={loadTree} notify={notify} aiReady={aiReady} onConfigureAi={() => setView("settings")} />;
      case "editor":
        return <EditorView noteId={activeNoteId} subjects={subjects} scope={scope} scopeTitle={scopeInfo.title} onScope={setScope} aiReady={aiReady} providerName={providerName} onBack={() => setView("hub")} onOpenNote={openNote} onNoteChanged={loadTree} onConfigureAi={() => setView("settings")} notify={notify} />;
      case "podcasts":
        return <PodcastsView subjects={subjects} scope={scope} onScope={setScope} scopeTitle={scopeInfo.title} aiReady={aiReady} providerName={providerName} onConfigureAi={() => setView("settings")} onGoHub={() => setView("hub")} notify={notify} />;
      case "flashcards":
        return <FlashcardsView subjects={subjects} scope={scope} onScope={setScope} scopeTitle={scopeInfo.title} aiReady={aiReady} providerName={providerName} onConfigureAi={() => setView("settings")} onGoHub={() => setView("hub")} notify={notify} />;
      case "quizzes":
        return <QuizzesView subjects={subjects} scope={scope} onScope={setScope} scopeTitle={scopeInfo.title} aiReady={aiReady} providerName={providerName} onConfigureAi={() => setView("settings")} onGoHub={() => setView("hub")} notify={notify} />;
      default:
        return <SettingsView boot={boot} onSettings={(next) => setBoot((current) => (current ? { ...current, settings: next } : current))} onReload={loadSettings} onTreeChanged={loadTree} notify={notify} />;
    }
  };

  return (
    <div className={`nitro-app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="brand-row">
          <button type="button" className="brand" onClick={() => setView("hub")} aria-label="Verity AI notes hub">
            <span className="brand-icon-wrap"><img src="/logo.png" alt="" className="brand-icon-img" /></span>
            <b>Verity<span>AI</span></b>
          </button>
          <button type="button" className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}</button>
        </div>
        <nav className="primary-nav" aria-label="Workspace views">
          <p>Workspace</p>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button type="button" className={view === id ? "active" : ""} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined} key={id}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span><small>{label}</small>
            </button>
          ))}
          <p>App</p>
          <button type="button" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")} aria-current={view === "settings" ? "page" : undefined}><Settings size={19} aria-hidden="true" /><span>Settings &amp; legal</span><small>Settings &amp; legal</small></button>
        </nav>
        <div className="sidebar-footer">
          <div className="scope-indicator" title={scopeInfo.title}><span className={`status-dot ${aiReady ? "ok" : "bad"}`} aria-hidden="true" /><span>{providerName}</span></div>
          <button type="button" onClick={toggleTheme} aria-label={`Switch to ${settings.theme === "dark" ? "light" : "dark"} theme`}>{settings.theme === "dark" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}<span>{settings.theme === "dark" ? "Dark theme" : "Light theme"}</span><small>Theme</small></button>
          <button type="button" className="profile-button" onClick={() => setView("settings")} title="Profile & AI Personalization"><span className="profile-avatar" aria-label="Your profile">Y</span><span><strong>You</strong><small>Profile &amp; AI Personalization</small></span></button>
        </div>
      </aside>
      <div className="mobile-topbar">
        <button type="button" className="icon-button" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle navigation"><Menu size={20} aria-hidden="true" /></button>
        <button type="button" className="brand" onClick={() => setView("hub")}><span className="brand-icon-wrap"><img src="/logo.png" alt="" className="brand-icon-img" /></span><b>Verity AI</b></button>
      </div>
      <div className="app-content" id="main-content" tabIndex={-1}>{renderView()}</div>
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone ?? "success"}`} role="status" key={toast.id}>
            {toast.tone === "error" ? <X size={16} aria-hidden="true" /> : <FileCheck2 size={16} aria-hidden="true" />}
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification"><X size={14} aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
