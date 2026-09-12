import type { NextRequest } from "next/server";
import { fail, HttpError, ok, readJson } from "@/lib/http";
import {
  cloneVoiceElevenLabs,
  DEFAULT_ELEVENLABS_VOICES,
  designPersonalizedVoiceElevenLabs,
  listElevenLabsVoices,
} from "@/lib/podcast/audio";
import {
  checkKokoCloneStatus,
  setupKokoClone,
  startKokoCloneServer,
  stopKokoCloneServer,
} from "@/lib/podcast/kokoclone-manager";
import { getElevenLabsApiKey, getPodcastAudioConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryKey = searchParams.get("apiKey");
    const checkKoko = searchParams.get("checkKokoClone") === "1";

    const savedKey = await getElevenLabsApiKey();
    const effectiveKey = (queryKey ? queryKey.trim() : "") || savedKey;

    const voices = await listElevenLabsVoices(effectiveKey);

    let kokoStatus = { running: false, message: "Not checked" };
    if (checkKoko) {
      const config = await getPodcastAudioConfig();
      const endpoint = (searchParams.get("kokoCloneEndpoint") || config.kokoCloneEndpoint || "http://127.0.0.1:7860").replace(/\/+$/, "");
      try {
        const res = await fetch(`${endpoint}/`, { signal: AbortSignal.timeout(3000) });
        kokoStatus = { running: res.ok || res.status < 500, message: `Connected to KokoClone at ${endpoint}` };
      } catch {
        kokoStatus = { running: false, message: `KokoClone is offline at ${endpoint}` };
      }
    }

    return ok({
      voices,
      hasKey: Boolean(effectiveKey),
      kokoStatus,
      defaultVoices: DEFAULT_ELEVENLABS_VOICES,
    });
  } catch (error) {
    return fail(error, "Failed to fetch voices.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const action = String(body.action || "");
    const savedKey = await getElevenLabsApiKey();
    const apiKey = (body.apiKey ? String(body.apiKey).trim() : "") || savedKey;

    if (action === "test-elevenlabs") {
      if (!apiKey) throw new HttpError("ElevenLabs API key is required.", 400);
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new HttpError(`ElevenLabs key verification failed (${res.status}): ${errText.slice(0, 150)}`, 401);
      }
      const data = await res.json();
      return ok({ valid: true, tier: data.subscription?.tier || "active", characterCount: data.subscription?.character_count });
    }

    if (action === "test-kokoclone" || action === "kokoclone-status") {
      const endpoint = String(body.endpoint || "http://127.0.0.1:7860");
      const status = await checkKokoCloneStatus(endpoint);
      return ok({
        ...status,
        running: status.serverRunning,
      });
    }

    if (action === "setup-kokoclone") {
      const result = await setupKokoClone();
      const status = await checkKokoCloneStatus(String(body.endpoint || "http://127.0.0.1:7860"));
      return ok({
        ...result,
        status,
      });
    }

    if (action === "start-kokoclone") {
      const endpoint = String(body.endpoint || "http://127.0.0.1:7860");
      const result = await startKokoCloneServer(endpoint);
      const status = await checkKokoCloneStatus(endpoint);
      return ok({
        ...result,
        status,
      });
    }

    if (action === "stop-kokoclone") {
      const endpoint = String(body.endpoint || "http://127.0.0.1:7860");
      const result = await stopKokoCloneServer(endpoint);
      const status = await checkKokoCloneStatus(endpoint);
      return ok({
        ...result,
        status,
      });
    }

    if (action === "design-from-personalization") {
      if (!apiKey) throw new HttpError("ElevenLabs API key is required to design a personalized voice.", 400);

      const personaLabel = String(body.personaLabel || "Friendly & Encouraging");
      const personaTone = String(body.personaTone || "Warm, enthusiastic, supportive");
      const learningStyleDesc = String(body.learningStyleDesc || "Visual & Structured explanations");
      const learnerName = body.learnerName ? String(body.learnerName) : undefined;
      const customInstructions = body.customInstructions ? String(body.customInstructions) : undefined;
      const role = body.role === "guest" ? "guest" : "host";

      const created = await designPersonalizedVoiceElevenLabs(apiKey, {
        personaLabel,
        personaTone,
        learningStyleDesc,
        learnerName,
        customInstructions,
        role,
      });

      return ok({
        voiceId: created.voiceId,
        voiceName: created.voiceName,
        message: `Personalized voice "${created.voiceName}" designed from your AI profile!`,
      });
    }

    if (action === "clone-from-audio") {
      if (!apiKey) throw new HttpError("ElevenLabs API key is required to clone a voice.", 400);

      const voiceName = String(body.voiceName || "My Cloned Voice").trim();
      const audioBase64 = String(body.audioBase64 || "");
      if (!audioBase64) throw new HttpError("Reference audio data is required.", 400);

      const rawBase64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
      if (!rawBase64) throw new HttpError("Reference audio data is required.", 400);
      const audioBuffer = Buffer.from(rawBase64, "base64");
      const fileName = String(body.fileName || "reference.wav");

      const cloned = await cloneVoiceElevenLabs(apiKey, voiceName, audioBuffer, fileName);
      return ok({
        voiceId: cloned.voiceId,
        voiceName: cloned.voiceName,
        message: `Voice "${cloned.voiceName}" successfully cloned!`,
      });
    }

    throw new HttpError("Unknown voice action.", 400);
  } catch (error) {
    return fail(error, "Voice operation failed.");
  }
}
