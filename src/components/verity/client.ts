import type { Scope, Subject } from "./types";

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Replacement model named by the provider when the selected one is retired. */
  suggestedModel?: string;
  constructor(message: string, status: number, code?: string, suggestedModel?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.suggestedModel = suggestedModel;
  }
}

/** Switches the active backend to `model` (key and endpoint are kept) and tells the app shell to refresh. */
export async function applySuggestedModel(model: string) {
  await api("/api/settings", { method: "PUT", json: { model } });
  window.dispatchEvent(new CustomEvent("verity:settings-changed"));
}

/** Minimal typed fetch wrapper for the local API. */
export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await response.text();
  let data: { error?: string; code?: string; suggestedModel?: string } | null = null;
  try {
    data = text ? (JSON.parse(text) as { error?: string; code?: string; suggestedModel?: string }) : null;
  } catch {
    data = null;
  }
  if (!response.ok) throw new ApiError(data?.error || `Request failed (${response.status})`, response.status, data?.code, data?.suggestedModel);
  return data as T;
}

export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function downloadFile(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.download = "";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export type ScopeInfo = { title: string; subject: Subject | null; chapter: Subject["chapters"][number] | null; noteCount: number };

export function describeScope(subjects: Subject[], scope: Scope | null): ScopeInfo {
  if (!scope) return { title: "No collection selected", subject: null, chapter: null, noteCount: 0 };
  if (scope.scopeType === "subject") {
    const subject = subjects.find((s) => s.id === scope.scopeId) ?? null;
    return { title: subject ? `${subject.name} · entire subject` : "", subject, chapter: null, noteCount: subject?.noteCount ?? 0 };
  }
  for (const subject of subjects) {
    const chapter = subject.chapters.find((c) => c.id === scope.scopeId);
    if (chapter) return { title: `${subject.name} › ${chapter.name}`, subject, chapter, noteCount: chapter.noteCount };
  }
  return { title: "", subject: null, chapter: null, noteCount: 0 };
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Decodes any browser-supported audio file to 16 kHz mono PCM for Whisper. */
export async function decodeAudioFile(file: File): Promise<{ pcm: Float32Array<ArrayBuffer>; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error("Audio decoding is not supported in this browser.");
  const context = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      const res = context.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      if (res && typeof (res as Promise<AudioBuffer>).then === "function") {
        (res as Promise<AudioBuffer>).then(resolve).catch(reject);
      }
    });
  } catch {
    throw new Error("This audio format could not be decoded. Try WAV, MP3, M4A, OGG, or FLAC.");
  } finally {
    void context.close().catch(() => undefined);
  }
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return { pcm: rendered.getChannelData(0), duration: decoded.duration };
}

/** Streams five-minute PCM segments to the local Whisper endpoint and joins the transcript. */
export async function transcribeAudio(file: File, onProgress: (info: { percent: number; label: string }) => void, language?: string) {
  onProgress({ percent: 2, label: "Decoding audio in your browser…" });
  const { pcm, duration } = await decodeAudioFile(file);
  const segmentSamples = 16000 * 300;
  const segments = Math.max(1, Math.ceil(pcm.length / segmentSamples));
  const parts: string[] = [];
  for (let index = 0; index < segments; index++) {
    onProgress({
      percent: 5 + Math.round((index / segments) * 90),
      label: `Transcribing locally ${formatClock(index * 300)}–${formatClock(Math.min(duration, (index + 1) * 300))} (part ${index + 1} of ${segments})…`,
    });
    const slice = pcm.slice(index * segmentSamples, (index + 1) * segmentSamples);
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-verity-sample-rate": "16000",
        ...(language ? { "x-verity-language": language } : {}),
      },
      body: new Blob([slice], { type: "application/octet-stream" }),
    });
    const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!response.ok) throw new Error(data.error || "Transcription failed.");
    parts.push((data.text ?? "").trim());
  }
  onProgress({ percent: 100, label: "Transcript ready" });
  return parts.filter(Boolean).join("\n\n");
}
