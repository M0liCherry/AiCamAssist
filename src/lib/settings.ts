import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDirectory, getDb } from "@/db";
import { settings, type Settings } from "@/db/schema";
import { migrateModelId, PROVIDER_PRESETS, ProviderError, type Provider, type ProviderConfig } from "@/lib/ai/provider";

/** Root folder for local data: ./.verity by default. */
export { dataDirectory };

export function diagnosticsLogPath() {
  return path.join(dataDirectory(), "logs", "diagnostics.log");
}

let cachedKey: Buffer | null = null;

/** AES-256-GCM key kept outside the database so a copied DB file alone cannot reveal API keys. */
function keyMaterial(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.VERITY_KEY_SECRET;
  if (secret) {
    cachedKey = crypto.createHash("sha256").update(secret).digest();
    return cachedKey;
  }
  const file = path.join(dataDirectory(), "local.key");
  try {
    const existing = fs.readFileSync(file);
    if (existing.length === 32) {
      cachedKey = existing;
      return existing;
    }
  } catch {
    // created below
  }
  try {
    fs.mkdirSync(dataDirectory(), { recursive: true });
    const key = crypto.randomBytes(32);
    fs.writeFileSync(file, key, { mode: 0o600 });
    cachedKey = key;
    return key;
  } catch (error) {
    console.warn("Data directory is not writable; using a derived encryption key.", error);
    cachedKey = crypto.createHash("sha256").update(`VerityAI:${process.env.DATABASE_URL ?? ""}`).digest();
    return cachedKey;
  }
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  try {
    const [version, iv, tag, data] = payload.split(":");
    if (version !== "v1") return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

let diagnosticsEnabled = false;
export function setDiagnostics(enabled: boolean) {
  diagnosticsEnabled = enabled;
}

/** Opt-in, local-only diagnostics: appended to a log file, never transmitted. */
export async function recordDiagnostic(context: string, error: unknown) {
  if (!diagnosticsEnabled) return;
  try {
    const file = diagnosticsLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const line = JSON.stringify({
      at: new Date().toISOString(),
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join(" | ") : undefined,
    });
    fs.appendFileSync(file, `${line}\n`);
  } catch {
    // diagnostics must never break the app
  }
}

export async function getSettingsRow(): Promise<Settings> {
  const db = await getDb();
  const [row] = await db.select().from(settings).limit(1);
  if (row) {
    diagnosticsEnabled = row.diagnosticsOptIn;
    return row;
  }
  // First boot: pin the singleton row to id 1 so concurrent starters collide
  // on the primary key instead of creating duplicates; the loser re-reads.
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing({ target: settings.id });
  const [created] = await db.select().from(settings).limit(1);
  if (!created) throw new Error("Settings could not be initialized.");
  diagnosticsEnabled = created.diagnosticsOptIn;
  return created;
}

export function toProviderConfig(row: Pick<Settings, "provider" | "model" | "embeddingModel" | "endpoint" | "apiKeyEncrypted">): ProviderConfig {
  const provider = (Object.keys(PROVIDER_PRESETS).includes(row.provider) ? row.provider : "none") as Provider;
  const preset = provider !== "none" ? PROVIDER_PRESETS[provider] : null;
  return {
    provider,
    // Models whose shutdown date has passed are swapped for their documented replacement.
    model: migrateModelId(row.model || preset?.model || ""),
    embeddingModel: migrateModelId(row.embeddingModel || preset?.embeddingModel || ""),
    endpoint: (row.endpoint || preset?.endpoint || "").replace(/\/+$/, ""),
    apiKey: decryptSecret(row.apiKeyEncrypted),
  };
}

export async function getProviderConfig(): Promise<ProviderConfig> {
  return toProviderConfig(await getSettingsRow());
}

export function requireProvider(cfg: ProviderConfig): ProviderConfig {
  if (cfg.provider === "none") {
    throw new ProviderError("No AI backend is configured. Open Settings → AI backend to add an API key or connect a local model.", 428, "no_provider");
  }
  return cfg;
}

/** Settings safe to send to the renderer (API key never leaves the server process). */
export function publicSettings(row: Settings) {
  const key = decryptSecret(row.apiKeyEncrypted);
  const elevenLabsKey = decryptSecret(row.elevenLabsApiKeyEncrypted);
  return {
    id: row.id,
    provider: row.provider,
    model: migrateModelId(row.model),
    embeddingModel: migrateModelId(row.embeddingModel),
    endpoint: row.endpoint,
    sttModel: row.sttModel,
    hasApiKey: key.length > 0,
    apiKeyHint: key ? `••••${key.slice(-4)}` : "",
    hasElevenLabsKey: elevenLabsKey.length > 0,
    elevenLabsKeyHint: elevenLabsKey ? `••••${elevenLabsKey.slice(-4)}` : "",
    podcastAudioEngine: (row.podcastAudioEngine || "speechSynthesis") as "speechSynthesis" | "elevenlabs" | "kokoclone",
    elevenLabsHostVoice: row.elevenLabsHostVoice || "21m00Tcm4TlvDq8ikWAM",
    elevenLabsGuestVoice: row.elevenLabsGuestVoice || "pNInz6obpgDQGcFmaJgB",
    kokoCloneEndpoint: row.kokoCloneEndpoint || "http://127.0.0.1:7860",
    onboardingComplete: row.onboardingComplete,
    privacyConsentAt: row.privacyConsentAt,
    providerConsentAt: row.providerConsentAt,
    diagnosticsOptIn: row.diagnosticsOptIn,
    theme: row.theme === "light" ? "light" : "dark",
    themeSeed: /^#[0-9A-Fa-f]{6}$/.test(row.themeSeed ?? "") ? (row.themeSeed as string).toUpperCase() : "#6750A4",
  };
}

export async function getElevenLabsApiKey(): Promise<string> {
  const row = await getSettingsRow();
  return decryptSecret(row.elevenLabsApiKeyEncrypted);
}

export async function getPodcastAudioConfig() {
  const row = await getSettingsRow();
  return {
    engine: (row.podcastAudioEngine || "speechSynthesis") as "speechSynthesis" | "elevenlabs" | "kokoclone",
    elevenLabsApiKey: decryptSecret(row.elevenLabsApiKeyEncrypted),
    elevenLabsHostVoice: row.elevenLabsHostVoice || "21m00Tcm4TlvDq8ikWAM",
    elevenLabsGuestVoice: row.elevenLabsGuestVoice || "pNInz6obpgDQGcFmaJgB",
    kokoCloneEndpoint: row.kokoCloneEndpoint || "http://127.0.0.1:7860",
  };
}
