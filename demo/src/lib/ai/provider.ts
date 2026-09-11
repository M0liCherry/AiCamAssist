/**
 * Unified inference layer. Every AI feature in NitroAI (RAG chat, summaries,
 * podcast scripts, flashcards, quizzes, embeddings) goes through this module so
 * the user's chosen backend powers all of them.
 *
 * Model names change often (providers retire models for new keys), so the
 * preset lists below are only fallbacks: `listModels()` asks each provider for
 * the models the user's key can actually use, and retired-model errors carry a
 * `suggestedModel` so the UI can offer a one-click switch.
 */
export type Provider = "none" | "gemini" | "anthropic" | "ollama" | "llamacpp";

export type ProviderConfig = {
  provider: Provider;
  model: string;
  embeddingModel: string;
  endpoint: string;
  apiKey: string;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatOptions = { json?: boolean; temperature?: number; maxTokens?: number; timeoutMs?: number };
export type EmbeddingResult = { vectors: number[][]; model: string };
export type ModelInfo = { id: string; label: string; recommended?: boolean };
export type ModelCatalog = { chat: ModelInfo[]; embedding: ModelInfo[] };

export type ProviderPreset = {
  label: string;
  shortLabel: string;
  model: string;
  embeddingModel: string;
  endpoint: string;
  needsKey: boolean;
  local: boolean;
  models: string[];
  embeddingModels: string[];
  keyUrl: string;
  description: string;
};

export const PROVIDER_PRESETS: Record<Exclude<Provider, "none">, ProviderPreset> = {
  gemini: {
    label: "Google Gemini API",
    shortLabel: "Gemini",
    model: "gemini-3.6-flash",
    embeddingModel: "gemini-embedding-2",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    needsKey: true,
    local: false,
    models: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview", "gemini-2.5-pro"],
    embeddingModels: ["gemini-embedding-2", "gemini-embedding-001"],
    keyUrl: "https://aistudio.google.com/app/apikey",
    description: "Cloud inference using your own Google AI Studio key. Note text is transmitted to Google only when you use an AI feature. Click “Load available models” to see exactly which models your key can use.",
  },
  anthropic: {
    label: "Anthropic Claude API",
    shortLabel: "Claude",
    model: "claude-sonnet-4-6",
    embeddingModel: "",
    endpoint: "https://api.anthropic.com/v1",
    needsKey: true,
    local: false,
    models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-opus-4-6", "claude-haiku-4-5"],
    embeddingModels: [],
    keyUrl: "https://console.anthropic.com/settings/keys",
    description: "Cloud inference using your Anthropic key. Claude offers no embedding endpoint, so retrieval uses on-device keyword ranking. Click “Load available models” to see the current Claude models for your key.",
  },
  ollama: {
    label: "Ollama (local models)",
    shortLabel: "Ollama",
    model: "qwen2.5:7b-instruct",
    embeddingModel: "nomic-embed-text",
    endpoint: "http://127.0.0.1:11434",
    needsKey: false,
    local: true,
    models: ["qwen3:8b", "qwen3:4b", "qwen2.5:7b-instruct", "qwen2.5:3b-instruct", "llama3.1:8b", "gemma3:4b"],
    embeddingModels: ["nomic-embed-text", "bge-m3", "all-minilm"],
    keyUrl: "https://ollama.com/download",
    description: "Fully offline inference on this PC. Download GGUF builds of Qwen 2.5 / Qwen 3 and other models directly from NitroAI.",
  },
  llamacpp: {
    label: "llama.cpp server / LM Studio",
    shortLabel: "llama.cpp",
    model: "default",
    embeddingModel: "",
    endpoint: "http://127.0.0.1:8080",
    needsKey: false,
    local: true,
    models: [],
    embeddingModels: [],
    keyUrl: "https://github.com/ggml-org/llama.cpp",
    description: "Any OpenAI-compatible local server (llama-server, LM Studio, Jan). Load a GGUF model there and point NitroAI at its endpoint.",
  },
};

/** Models with a passed shutdown date → drop-in replacement (applied silently). */
export const RETIRED_MODELS: Record<string, string> = {
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-flash-001": "gemini-3.6-flash",
  "gemini-2.0-flash-lite": "gemini-3.5-flash-lite",
  "gemini-2.0-flash-lite-001": "gemini-3.5-flash-lite",
  "gemini-1.5-flash": "gemini-3.6-flash",
  "gemini-1.5-flash-8b": "gemini-3.5-flash-lite",
  "gemini-1.5-pro": "gemini-2.5-pro",
  "text-embedding-004": "gemini-embedding-2",
  "embedding-001": "gemini-embedding-2",
};

/** Models that still exist but are gated/legacy → what to suggest when they fail. */
const LEGACY_HINTS: Record<string, string> = {
  ...RETIRED_MODELS,
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
  "gemini-3-flash-preview": "gemini-3.6-flash",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
  "gemini-embedding-001": "gemini-embedding-2",
  "claude-sonnet-4-5": "claude-sonnet-4-6",
  "claude-opus-4-5": "claude-opus-4-7",
  "claude-opus-4-1": "claude-opus-4-7",
  "claude-sonnet-4": "claude-sonnet-4-6",
};

export function migrateModelId(id: string) {
  return RETIRED_MODELS[id] ?? id;
}

export class ProviderError extends Error {
  status: number;
  code: string;
  suggestedModel?: string;
  constructor(message: string, status = 502, code = "provider_error", suggestedModel?: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.suggestedModel = suggestedModel;
  }
}

export const isLocalProvider = (provider: Provider) => provider === "ollama" || provider === "llamacpp";
export const providerLabel = (provider: Provider) =>
  provider === "none" ? "No AI backend" : PROVIDER_PRESETS[provider].label;
export const supportsEmbeddings = (cfg: ProviderConfig) =>
  cfg.provider === "gemini" || cfg.provider === "ollama" || cfg.provider === "llamacpp";

export const LOCAL_CONTEXT_TOKENS = Math.max(4096, Number(process.env.NITRO_LOCAL_CONTEXT ?? 8192) || 8192);

/** Character budget for source material per request, sized to the backend's context window. */
export function contextBudgetChars(cfg: ProviderConfig) {
  return isLocalProvider(cfg.provider) ? Math.floor(LOCAL_CONTEXT_TOKENS * 3.4 * 0.5) : 90_000;
}

type ErrorPayload = {
  error?: { message?: string; type?: string; code?: string; status?: string } | string;
  message?: string;
  raw?: string;
};
type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};
type AnthropicResponse = { content?: { type: string; text?: string }[]; stop_reason?: string };
type OllamaChatResponse = { message?: { content?: string }; error?: string };
type OpenAIChatResponse = { choices?: { message?: { content?: string } }[] };

function describe(payload: ErrorPayload) {
  const err = payload.error;
  const text = typeof err === "string" ? err : err?.message || payload.message || payload.raw || "";
  return text.replace(/\s+/g, " ").slice(0, 320);
}

/** Pulls a replacement model id out of provider messages such as "…update your code to use models/gemini-3.6-flash…". */
export function suggestedModelFromText(text: string): string | undefined {
  const match = text.match(/(?:use|switch to|migrate to|try|instead use)\s+["'`]?(?:models\/)?((?:gemini|gemma|claude|learnlm)[\w.\-:]*\w)/i);
  return match?.[1];
}

const MODEL_MISSING = /not found|no longer available|not available|does not exist|is not supported for generateContent|unknown model|invalid model|decommissioned|deprecated/i;

function mapHttpError(status: number, payload: ErrorPayload, label: string) {
  const detail = describe(payload);
  const suffix = detail ? ` Details: ${detail}` : "";
  const suggestion = suggestedModelFromText(detail);
  if (status === 401 || status === 403) {
    return new ProviderError(`${label} rejected the API key (HTTP ${status}). Check the key in Settings → AI backend.${suffix}`, 401, "unauthorized");
  }
  if (status === 404 || (status === 400 && MODEL_MISSING.test(detail))) {
    const hint = suggestion
      ? ` Switch to ${suggestion} (${label}'s recommended replacement).`
      : " Open Settings → AI backend and click “Load available models” to pick a current model.";
    return new ProviderError(`${label} could not use the selected model.${hint}${suffix}`, 404, "model_not_found", suggestion);
  }
  if (status === 429) return new ProviderError(`${label} rate limit or quota reached. Wait a moment or review your plan.${suffix}`, 429, "rate_limited");
  if (status === 400 || status === 422) return new ProviderError(`${label} rejected the request.${suffix}`, 400, "bad_request");
  if (status >= 500) return new ProviderError(`${label} is having trouble (HTTP ${status}). Try again shortly.${suffix}`, 502, "upstream_error");
  return new ProviderError(`${label} returned HTTP ${status}.${suffix}`, 502);
}

function normalizeError(error: unknown, label: string, url: string): ProviderError {
  if (error instanceof ProviderError) return error;
  const err = error as { name?: string; message?: string; cause?: { code?: string } };
  if (err?.name === "AbortError") {
    return new ProviderError(`${label} did not respond in time. Local models may need a smaller model or a shorter selection of notes.`, 504, "timeout");
  }
  const code = err?.cause?.code ?? "";
  if (["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].includes(code)) {
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      host = url;
    }
    const local = /^(127\.|localhost|0\.0\.0\.0|\[::1\])/.test(host);
    return new ProviderError(
      local
        ? `Could not reach ${label} at ${host}. Start the local runtime (for Ollama, open the Ollama app) and confirm the endpoint in Settings.`
        : `Could not reach ${label} at ${host}. Check your internet connection or firewall.`,
      503,
      "unreachable",
    );
  }
  return new ProviderError(`${label} request failed: ${err?.message ?? "unknown error"}`, 502);
}

async function request<T>(url: string, init: RequestInit, label: string, timeoutMs = 180_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { raw };
    }
    if (!response.ok) throw mapHttpError(response.status, (data ?? {}) as ErrorPayload, label);
    return data as T;
  } catch (error) {
    throw normalizeError(error, label, url);
  } finally {
    clearTimeout(timer);
  }
}

/** Adds a replacement hint for known legacy models when the provider did not name one. */
function withModelHint<T>(cfg: ProviderConfig, work: Promise<T>): Promise<T> {
  return work.catch((error: unknown) => {
    if (error instanceof ProviderError && error.code === "model_not_found" && !error.suggestedModel) {
      const hint = LEGACY_HINTS[cfg.model];
      if (hint) {
        error.suggestedModel = hint;
        error.message = error.message.replace(" Open Settings → AI backend and click “Load available models” to pick a current model.", ` Switch to ${hint}, the recommended replacement.`);
      }
    }
    throw error;
  });
}

export function stripThinking(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function normalizeAlternating(turns: ChatMessage[]) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const turn of turns) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    if (!out.length && role === "assistant") continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${turn.content}`;
    else out.push({ role, content: turn.content });
  }
  if (!out.length) out.push({ role: "user", content: "Hello" });
  return out;
}

const authHeader = (cfg: ProviderConfig): Record<string, string> => (cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {});

export async function chatCompletion(cfg: ProviderConfig, messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const temperature = options.temperature ?? 0.4;

  switch (cfg.provider) {
    case "gemini": {
      const body = {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: turns.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          temperature,
          maxOutputTokens: options.maxTokens ?? 8192,
          ...(options.json ? { responseMimeType: "application/json" } : {}),
        },
      };
      const data = await withModelHint(
        cfg,
        request<GeminiResponse>(
          `${cfg.endpoint}/models/${encodeURIComponent(cfg.model)}:generateContent`,
          { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey }, body: JSON.stringify(body) },
          "Gemini",
          options.timeoutMs,
        ),
      );
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) {
        const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? "empty response";
        const advice = reason === "MAX_TOKENS" ? " The output limit was reached before an answer was produced; try fewer items or a shorter scope." : "";
        throw new ProviderError(`Gemini returned no text (${reason}).${advice}`, 502, "empty");
      }
      return text;
    }
    case "anthropic": {
      // Temperature is intentionally omitted: newer Claude models reject non-default sampling parameters.
      const data = await withModelHint(
        cfg,
        request<AnthropicResponse>(
          `${cfg.endpoint}/messages`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: cfg.model,
              max_tokens: options.maxTokens ?? 8192,
              ...(system ? { system } : {}),
              messages: normalizeAlternating(turns),
            }),
          },
          "Claude",
          options.timeoutMs,
        ),
      );
      const text = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
      if (!text.trim()) throw new ProviderError("Claude returned an empty response.", 502, "empty");
      return text;
    }
    case "ollama": {
      const data = await request<OllamaChatResponse>(
        `${cfg.endpoint}/api/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: cfg.model,
            messages: [...(system ? [{ role: "system", content: system }] : []), ...turns],
            stream: false,
            ...(options.json ? { format: "json" } : {}),
            options: { temperature, num_ctx: LOCAL_CONTEXT_TOKENS, num_predict: options.maxTokens ?? 3000 },
          }),
        },
        "Ollama",
        options.timeoutMs ?? 600_000,
      );
      if (data.error) throw new ProviderError(`Ollama error: ${data.error}`, 502);
      const text = stripThinking(data.message?.content ?? "");
      if (!text.trim()) throw new ProviderError("The local model returned an empty response. Try a different or larger model.", 502, "empty");
      return text;
    }
    case "llamacpp": {
      const data = await request<OpenAIChatResponse>(
        `${cfg.endpoint}/v1/chat/completions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(cfg) },
          body: JSON.stringify({
            model: cfg.model || "default",
            messages: [...(system ? [{ role: "system", content: system }] : []), ...turns],
            temperature,
            max_tokens: options.maxTokens ?? 3000,
            ...(options.json ? { response_format: { type: "json_object" } } : {}),
          }),
        },
        "llama.cpp server",
        options.timeoutMs ?? 600_000,
      );
      const text = stripThinking(data.choices?.[0]?.message?.content ?? "");
      if (!text.trim()) throw new ProviderError("The local server returned an empty response.", 502, "empty");
      return text;
    }
    default:
      throw new ProviderError("No AI backend is configured. Open Settings → AI backend to connect one.", 428, "no_provider");
  }
}

async function geminiEmbed(cfg: ProviderConfig, texts: string[], kind: "document" | "query"): Promise<EmbeddingResult> {
  const vectors: number[][] = [];
  const call = (batch: string[], withDimensions: boolean) =>
    request<{ embeddings?: { values: number[] }[] }>(
      `${cfg.endpoint}/models/${encodeURIComponent(cfg.embeddingModel)}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${cfg.embeddingModel}`,
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
            ...(withDimensions ? { outputDimensionality: 768 } : {}),
          })),
        }),
      },
      "Gemini",
      120_000,
    );
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);
    let data: { embeddings?: { values: number[] }[] };
    try {
      data = await call(batch, true);
    } catch (error) {
      // Older/newer embedding models may not accept outputDimensionality; retry with the model default.
      if (error instanceof ProviderError && error.code === "bad_request") data = await call(batch, false);
      else throw error;
    }
    const values = data.embeddings?.map((e) => e.values) ?? [];
    if (values.length !== batch.length) throw new ProviderError("Gemini returned an incomplete embedding batch.");
    vectors.push(...values);
  }
  return { vectors, model: cfg.embeddingModel };
}

async function ollamaEmbed(cfg: ProviderConfig, texts: string[]): Promise<EmbeddingResult> {
  const candidates = [cfg.embeddingModel, cfg.model].filter((m, i, arr) => m && arr.indexOf(m) === i);
  let lastError: unknown = null;
  for (const model of candidates) {
    try {
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += 16) {
        const batch = texts.slice(i, i + 16);
        const data = await request<{ embeddings?: number[][]; error?: string }>(
          `${cfg.endpoint}/api/embed`,
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, input: batch, truncate: true }) },
          "Ollama",
          300_000,
        );
        if (!data.embeddings || data.embeddings.length !== batch.length) {
          throw new ProviderError(data.error || "Ollama returned an incomplete embedding batch.");
        }
        vectors.push(...data.embeddings);
      }
      return { vectors, model };
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderError && error.code === "unreachable") throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new ProviderError("Ollama embeddings failed.");
}

async function openAiEmbed(cfg: ProviderConfig, texts: string[]): Promise<EmbeddingResult> {
  const model = cfg.embeddingModel || cfg.model || "default";
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) {
    const batch = texts.slice(i, i + 16);
    const data = await request<{ data?: { embedding: number[] }[] }>(
      `${cfg.endpoint}/v1/embeddings`,
      { method: "POST", headers: { "content-type": "application/json", ...authHeader(cfg) }, body: JSON.stringify({ model, input: batch }) },
      "llama.cpp server",
      300_000,
    );
    const values = data.data?.map((d) => d.embedding) ?? [];
    if (values.length !== batch.length) throw new ProviderError("The local server returned an incomplete embedding batch.");
    vectors.push(...values);
  }
  return { vectors, model };
}

/**
 * Embeds text with the active backend. Never throws: when embeddings are
 * unavailable (Claude, missing embedding model, offline runtime) it returns
 * null and retrieval transparently falls back to on-device keyword ranking.
 */
export async function embedTexts(cfg: ProviderConfig, texts: string[], kind: "document" | "query"): Promise<EmbeddingResult | null> {
  if (!texts.length) return { vectors: [], model: cfg.embeddingModel };
  if (!supportsEmbeddings(cfg)) return null;
  try {
    if (cfg.provider === "gemini") return await geminiEmbed(cfg, texts, kind);
    if (cfg.provider === "ollama") return await ollamaEmbed(cfg, texts);
    if (cfg.provider === "llamacpp") return await openAiEmbed(cfg, texts);
    return null;
  } catch (error) {
    console.warn("Embeddings unavailable; using keyword retrieval.", error instanceof Error ? error.message : error);
    return null;
  }
}

export function sameModel(a: string, b: string) {
  const norm = (value: string) => value.trim().toLowerCase().replace(/:latest$/, "");
  return norm(a) === norm(b);
}

/* ------------------------------ Model discovery ------------------------------ */

const NON_CHAT = /(image|tts|live|audio|transcribe|robotics|veo|imagen|lyria|aqa|embedding|computer-use|deep-research|translate)/i;
const EMBEDDING_NAME = /(embed|bge|minilm|e5-|arctic|mxbai|nomic|gte-)/i;

function versionOf(id: string) {
  const match = id.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : 0;
}

function byVersionDesc(a: ModelInfo, b: ModelInfo) {
  return versionOf(b.id) - versionOf(a.id) || a.id.localeCompare(b.id);
}

function markRecommended(list: ModelInfo[], pick: (m: ModelInfo) => boolean) {
  const chosen = list.find(pick) ?? list[0];
  return list.map((m) => ({ ...m, recommended: m === chosen }));
}

async function geminiCatalog(cfg: ProviderConfig): Promise<ModelCatalog> {
  type Entry = { name: string; displayName?: string; supportedGenerationMethods?: string[] };
  const models: Entry[] = [];
  let pageToken = "";
  do {
    const url = new URL(`${cfg.endpoint}/models`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await request<{ models?: Entry[]; nextPageToken?: string }>(url.toString(), { method: "GET", headers: { "x-goog-api-key": cfg.apiKey } }, "Gemini", 30_000);
    models.push(...(page.models ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken && models.length < 1000);

  const toInfo = (entry: Entry): ModelInfo => {
    const id = entry.name.replace(/^models\//, "");
    return { id, label: entry.displayName && entry.displayName !== id ? `${id} — ${entry.displayName}` : id };
  };
  const chat = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /^models\/(gemini|gemma|learnlm)/.test(m.name) && !NON_CHAT.test(m.name))
    .map(toInfo)
    .sort(byVersionDesc);
  const embedding = models
    .filter((m) => m.supportedGenerationMethods?.includes("embedContent"))
    .map(toInfo)
    .sort(byVersionDesc);
  return {
    chat: markRecommended(chat, (m) => /^gemini-\d+(\.\d+)?-flash$/.test(m.id)),
    embedding: markRecommended(embedding, (m) => /^gemini-embedding/.test(m.id)),
  };
}

async function anthropicCatalog(cfg: ProviderConfig): Promise<ModelCatalog> {
  type Entry = { id: string; display_name?: string; created_at?: string };
  const entries: Entry[] = [];
  let afterId = "";
  do {
    const url = new URL(`${cfg.endpoint}/models`);
    url.searchParams.set("limit", "1000");
    if (afterId) url.searchParams.set("after_id", afterId);
    const page = await request<{ data?: Entry[]; has_more?: boolean; last_id?: string }>(
      url.toString(),
      { method: "GET", headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" } },
      "Claude",
      30_000,
    );
    entries.push(...(page.data ?? []));
    afterId = page.has_more && page.last_id ? page.last_id : "";
  } while (afterId && entries.length < 2000);
  // The API lists newest first; keep that order.
  const chat = entries.map((e) => ({ id: e.id, label: e.display_name && e.display_name !== e.id ? `${e.id} — ${e.display_name}` : e.id }));
  return { chat: markRecommended(chat, (m) => /sonnet/i.test(m.id)), embedding: [] };
}

async function openAiCatalog(cfg: ProviderConfig): Promise<ModelCatalog> {
  const data = await request<{ data?: { id: string }[] }>(`${cfg.endpoint}/v1/models`, { method: "GET", headers: authHeader(cfg) }, "llama.cpp server", 15_000);
  const all = (data.data ?? []).map((m) => ({ id: m.id, label: m.id }));
  const chat = all.filter((m) => !EMBEDDING_NAME.test(m.id));
  const embedding = all.filter((m) => EMBEDDING_NAME.test(m.id));
  return { chat: markRecommended(chat.length ? chat : all, () => true), embedding: markRecommended(embedding, () => true) };
}

/** Lists the models the configured key/runtime can use right now. */
export async function listModels(cfg: ProviderConfig): Promise<ModelCatalog> {
  switch (cfg.provider) {
    case "gemini":
      if (!cfg.apiKey) throw new ProviderError("Enter your Gemini API key first.", 400, "missing_key");
      return geminiCatalog(cfg);
    case "anthropic":
      if (!cfg.apiKey) throw new ProviderError("Enter your Claude API key first.", 400, "missing_key");
      return anthropicCatalog(cfg);
    case "llamacpp":
      return openAiCatalog(cfg);
    case "ollama": {
      const status = await ollamaStatus(cfg.endpoint);
      if (!status.running) throw new ProviderError(status.error ?? "Ollama is not running.", 503, "unreachable");
      const all = status.models.map((m) => ({ id: m.name, label: m.parameterSize ? `${m.name} (${m.parameterSize})` : m.name }));
      const chat = all.filter((m) => !EMBEDDING_NAME.test(m.id));
      const embedding = all.filter((m) => EMBEDDING_NAME.test(m.id));
      return { chat: markRecommended(chat, (m) => sameModel(m.id, cfg.model)), embedding: markRecommended(embedding, (m) => sameModel(m.id, cfg.embeddingModel)) };
    }
    default:
      throw new ProviderError("Choose an AI backend first.", 400, "no_provider");
  }
}

export type OllamaStatus = {
  running: boolean;
  version?: string;
  models: { name: string; size: number; parameterSize?: string; family?: string }[];
  error?: string;
};

export async function ollamaStatus(endpoint: string): Promise<OllamaStatus> {
  const base = endpoint.replace(/\/+$/, "");
  try {
    const tags = await request<{ models?: { name: string; size: number; details?: { parameter_size?: string; family?: string } }[] }>(
      `${base}/api/tags`,
      { method: "GET" },
      "Ollama",
      8_000,
    );
    let version: string | undefined;
    try {
      version = (await request<{ version?: string }>(`${base}/api/version`, { method: "GET" }, "Ollama", 5_000)).version;
    } catch {
      version = undefined;
    }
    return {
      running: true,
      version,
      models: (tags.models ?? []).map((m) => ({ name: m.name, size: m.size, parameterSize: m.details?.parameter_size, family: m.details?.family })),
    };
  } catch (error) {
    return { running: false, models: [], error: error instanceof Error ? error.message : "Ollama is not reachable." };
  }
}

/** Streams an Ollama model download (NDJSON progress events). */
export async function pullOllamaModel(endpoint: string, model: string): Promise<Response> {
  const base = endpoint.replace(/\/+$/, "");
  const url = `${base}/api/pull`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      cache: "no-store",
    });
    if (!response.ok || !response.body) {
      const raw = await response.text().catch(() => "");
      let payload: ErrorPayload;
      try {
        payload = JSON.parse(raw) as ErrorPayload;
      } catch {
        payload = { raw };
      }
      throw mapHttpError(response.status, payload, "Ollama");
    }
    return response;
  } catch (error) {
    throw normalizeError(error, "Ollama", url);
  }
}

export async function testProvider(cfg: ProviderConfig): Promise<{ ok: true; detail: string }> {
  if (cfg.provider === "none") throw new ProviderError("Choose an AI backend first.", 400, "no_provider");
  if (PROVIDER_PRESETS[cfg.provider].needsKey && !cfg.apiKey) {
    throw new ProviderError(`${providerLabel(cfg.provider)} needs an API key.`, 400, "missing_key");
  }
  if (cfg.provider === "ollama") {
    const status = await ollamaStatus(cfg.endpoint);
    if (!status.running) throw new ProviderError(status.error ?? "Ollama is not running.", 503, "unreachable");
    if (!status.models.some((m) => sameModel(m.name, cfg.model))) {
      const installed = status.models.map((m) => m.name).join(", ");
      throw new ProviderError(
        `Model "${cfg.model}" is not downloaded yet. ${installed ? `Installed models: ${installed}.` : "Use “Download model” to fetch it."}`,
        404,
        "model_not_found",
      );
    }
  }
  const started = Date.now();
  const reply = await chatCompletion(cfg, [{ role: "user", content: "Reply with the single word OK." }], {
    maxTokens: 1024,
    temperature: 0,
    timeoutMs: 120_000,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  return { ok: true, detail: `${providerLabel(cfg.provider)} · ${cfg.model} responded in ${seconds}s (“${reply.trim().slice(0, 40)}”).` };
}
