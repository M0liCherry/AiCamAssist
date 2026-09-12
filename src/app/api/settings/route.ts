import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { APP_VERSION, PUBLISHER, STT_MODELS } from "@/config/app";
import { getDb, isDesktopMode, usesEmbeddedDatabase } from "@/db";
import { chapters, chatMessages, chunks, flashcardProgress, generatedAssets, notes, quizAttempts, settings, subjects } from "@/db/schema";
import { PROVIDER_PRESETS, type Provider } from "@/lib/ai/provider";
import { cleanText, fail, HttpError, ok, readJson } from "@/lib/http";
import { dataDirectory, decryptSecret, diagnosticsLogPath, encryptSecret, getSettingsRow, publicSettings, setDiagnostics } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PROVIDERS: Provider[] = ["none", "gemini", "anthropic", "ollama", "llamacpp"];

function environment() {
  return {
    desktop: isDesktopMode(),
    dataDir: dataDirectory(),
    database: usesEmbeddedDatabase() ? "PGlite (embedded PostgreSQL, local folder)" : "PostgreSQL server",
    version: APP_VERSION,
    platform: process.platform,
    node: process.version,
    logPath: diagnosticsLogPath(),
  };
}

export async function GET() {
  try {
    const row = await getSettingsRow();
    return ok({ settings: publicSettings(row), environment: environment(), publisher: PUBLISHER, presets: PROVIDER_PRESETS, sttModels: STT_MODELS });
  } catch (error) {
    return fail(error, "Settings could not be loaded.", 503);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJson(request);
    const db = await getDb();
    const current = await getSettingsRow();
    const patch: Partial<typeof settings.$inferInsert> = { updatedAt: new Date() };

    // A model/embedding/endpoint change without an explicit provider applies to the current provider
    // (used by the one-click "switch to the recommended model" fix).
    const touchesBackend = body.provider !== undefined || body.model !== undefined || body.embeddingModel !== undefined || body.endpoint !== undefined;
    if (touchesBackend) {
      const provider = (body.provider !== undefined ? String(body.provider) : current.provider) as Provider;
      if (!PROVIDERS.includes(provider)) throw new HttpError("Unknown AI provider.");
      if (provider === "none" && body.provider === undefined) throw new HttpError("Choose an AI backend before selecting a model.");
      const preset = provider === "none" ? null : PROVIDER_PRESETS[provider];
      const keepCurrent = provider === current.provider;
      const model = cleanText(body.model, 160) || (keepCurrent ? current.model : "") || preset?.model || "";
      const embeddingModel = cleanText(body.embeddingModel, 160) || (keepCurrent ? current.embeddingModel : "") || preset?.embeddingModel || "";
      const endpoint = (cleanText(body.endpoint, 400) || (keepCurrent ? current.endpoint : "") || preset?.endpoint || "").replace(/\/+$/, "");
      if (preset && endpoint && !/^https?:\/\//i.test(endpoint)) throw new HttpError("The endpoint must start with http:// or https://.");
      if (preset && !model) throw new HttpError("Choose a model.");

      const incomingKey = cleanText(body.apiKey, 500);
      const clearKey = body.clearApiKey === true;
      const storedKey = clearKey ? "" : decryptSecret(current.apiKeyEncrypted);
      const effectiveKey = incomingKey || storedKey;
      if (preset?.needsKey && !effectiveKey) throw new HttpError(`${preset.label} requires an API key.`);

      const providerChanged = provider !== current.provider;
      if (preset && !preset.local && (providerChanged || incomingKey) && body.providerConsent !== true) {
        throw new HttpError("Please confirm that note text may be sent to the selected API provider when you use AI features.");
      }

      Object.assign(patch, { provider, model, embeddingModel, endpoint });
      if (incomingKey) patch.apiKeyEncrypted = encryptSecret(incomingKey);
      else if (clearKey) patch.apiKeyEncrypted = null;
      if (body.providerConsent === true) patch.providerConsentAt = new Date();
    }

    if (body.sttModel !== undefined) {
      const sttModel = cleanText(body.sttModel, 160);
      if (!STT_MODELS.includes(sttModel)) throw new HttpError("Unknown speech-to-text model.");
      patch.sttModel = sttModel;
    }

    if (body.elevenLabsApiKey !== undefined) {
      const incomingElevenKey = cleanText(body.elevenLabsApiKey, 500);
      if (incomingElevenKey) patch.elevenLabsApiKeyEncrypted = encryptSecret(incomingElevenKey);
    }
    if (body.clearElevenLabsApiKey === true) {
      patch.elevenLabsApiKeyEncrypted = null;
    }
    if (body.podcastAudioEngine !== undefined) {
      const engine = String(body.podcastAudioEngine);
      if (["speechSynthesis", "elevenlabs", "kokoclone"].includes(engine)) {
        patch.podcastAudioEngine = engine;
      }
    }
    if (body.elevenLabsHostVoice !== undefined) {
      patch.elevenLabsHostVoice = cleanText(body.elevenLabsHostVoice, 80);
    }
    if (body.elevenLabsGuestVoice !== undefined) {
      patch.elevenLabsGuestVoice = cleanText(body.elevenLabsGuestVoice, 80);
    }
    if (body.kokoCloneEndpoint !== undefined) {
      patch.kokoCloneEndpoint = cleanText(body.kokoCloneEndpoint, 255) || "http://127.0.0.1:7860";
    }

    if (body.privacyConsent === true) patch.privacyConsentAt = new Date();
    if (typeof body.diagnosticsOptIn === "boolean") patch.diagnosticsOptIn = body.diagnosticsOptIn;
    if (typeof body.onboardingComplete === "boolean") {
      if (body.onboardingComplete && !current.privacyConsentAt && body.privacyConsent !== true) {
        throw new HttpError("Accept the Privacy Policy to finish setup.");
      }
      patch.onboardingComplete = body.onboardingComplete;
    }
    if (body.theme === "dark" || body.theme === "light") patch.theme = body.theme;

    const [updated] = await db.update(settings).set(patch).where(eq(settings.id, current.id)).returning();
    if (!updated) throw new HttpError("Settings could not be found.", 404);
    setDiagnostics(updated.diagnosticsOptIn);
    return ok({ settings: publicSettings(updated) });
  } catch (error) {
    return fail(error, "Settings could not be saved.");
  }
}

/** Erases every locally stored note, collection, asset, and setting. */
export async function DELETE(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("confirm") !== "ERASE") throw new HttpError("Confirmation is required to erase local data.");
    const db = await getDb();
    await db.delete(quizAttempts);
    await db.delete(flashcardProgress);
    await db.delete(generatedAssets);
    await db.delete(chatMessages);
    await db.delete(chunks);
    await db.delete(notes);
    await db.delete(chapters);
    await db.delete(subjects);
    await db.delete(settings);
    // Remove generated files too (keeps local.key and cached models so setup stays cheap).
    fs.rmSync(path.join(dataDirectory(), "media"), { recursive: true, force: true });
    fs.rmSync(diagnosticsLogPath(), { force: true });
    setDiagnostics(false);
    return ok({ ok: true });
  } catch (error) {
    return fail(error, "Local data could not be erased.");
  }
}
