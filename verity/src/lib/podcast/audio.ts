import fs from "node:fs";
import path from "node:path";
import { dataDirectory } from "@/db";

export type PodcastVoiceInfo = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  previewUrl?: string;
};

export const DEFAULT_ELEVENLABS_VOICES: PodcastVoiceInfo[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "premade", description: "Calm, warm, articulate female host" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "premade", description: "Deep, natural, engaging male speaker" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "premade", description: "Pleasant, balanced explanatory tone" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "premade", description: "Bright, enthusiastic, dynamic female voice" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", category: "premade", description: "Australian, friendly, conversational" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", category: "premade", description: "British, scholarly, reflective expert" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "premade", description: "Young, clear, accessible American voice" },
  { id: "piTKgcLEGmPE4e6mEKli", name: "Nicole", category: "premade", description: "Clear, composed, audio-guide precision" },
];

/** Root directory for saved podcast audio files */
export function podcastAudioDir(assetId: number | string): string {
  const dir = path.join(dataDirectory(), "media", "podcasts", String(assetId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Lists all available voices for ElevenLabs with fallbacks */
export async function listElevenLabsVoices(apiKey?: string): Promise<PodcastVoiceInfo[]> {
  if (!apiKey) return DEFAULT_ELEVENLABS_VOICES;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) return DEFAULT_ELEVENLABS_VOICES;
    const data = (await res.json()) as { voices?: Array<{ voice_id: string; name: string; category?: string; description?: string; preview_url?: string }> };
    if (!Array.isArray(data.voices) || data.voices.length === 0) return DEFAULT_ELEVENLABS_VOICES;
    return data.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description,
      previewUrl: v.preview_url,
    }));
  } catch {
    return DEFAULT_ELEVENLABS_VOICES;
  }
}

/** Synthesize a single turn of text using ElevenLabs TTS */
export async function synthesizeElevenLabsTurn(
  apiKey: string,
  voiceId: string,
  text: string,
): Promise<Buffer> {
  if (!apiKey) throw new Error("ElevenLabs API key is not configured.");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `ElevenLabs error (${res.status})`;
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.detail?.message || parsed.message || msg;
    } catch {
      if (errBody) msg += `: ${errBody.slice(0, 180)}`;
    }
    throw new Error(msg);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Creates or designs a voice on ElevenLabs based on the user's AI personalization
 * (persona, learning style, and custom instructions).
 */
export async function designPersonalizedVoiceElevenLabs(
  apiKey: string,
  options: {
    personaLabel: string;
    personaTone: string;
    learningStyleDesc: string;
    learnerName?: string;
    customInstructions?: string;
    role: "host" | "guest";
  },
): Promise<{ voiceId: string; voiceName: string }> {
  if (!apiKey) throw new Error("ElevenLabs API key is required to design a voice.");

  const voiceName = `Verity ${options.role === "host" ? "Host" : "Guest"} (${options.personaLabel.split(" ")[0]})`;

  const description = [
    `A ${options.role === "host" ? "engaging podcast host" : "expert educator and guest"} with a ${options.personaLabel} demeanor.`,
    `Tone characteristics: ${options.personaTone}.`,
    `Explains topics tailored for learners who prefer ${options.learningStyleDesc}.`,
    options.customInstructions ? `Special guidance: ${options.customInstructions.slice(0, 150)}.` : "",
    "Natural pauses, crystal-clear articulation, warmth, and educational broadcast quality.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 950);

  // 1. Call /v1/text-to-voice/design to generate voice previews
  const designRes = await fetch("https://api.elevenlabs.io/v1/text-to-voice/design", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_description: description.length >= 20 ? description : `A warm and articulate educational podcast ${options.role} voice.`,
      model_id: "eleven_multilingual_ttv_v2",
      text: "Welcome to VerityAI educational overview. We break down the most essential concepts from your study notes into memorable, clear discussions.",
      auto_generate_text: false,
    }),
  });

  if (!designRes.ok) {
    const err = await designRes.text();
    throw new Error(`Voice design failed: ${err.slice(0, 200)}`);
  }

  const designData = (await designRes.json()) as {
    previews?: Array<{ generated_voice_id: string; audio_base_64?: string }>;
  };

  const preview = designData.previews?.[0];
  if (!preview?.generated_voice_id) {
    throw new Error("No voice preview returned from ElevenLabs voice design.");
  }

  // 2. Save the voice preview permanently to the user's account
  const createRes = await fetch("https://api.elevenlabs.io/v1/text-to-voice", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_name: voiceName,
      voice_description: description.slice(0, 950),
      generated_voice_id: preview.generated_voice_id,
      labels: {
        source: "verity_ai",
        persona: options.personaLabel,
        role: options.role,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Saving designed voice failed: ${err.slice(0, 200)}`);
  }

  const createdData = (await createRes.json()) as { voice_id: string };
  return {
    voiceId: createdData.voice_id || preview.generated_voice_id,
    voiceName,
  };
}

/**
 * Clones a voice on ElevenLabs using an uploaded reference audio sample.
 */
export async function cloneVoiceElevenLabs(
  apiKey: string,
  voiceName: string,
  audioBuffer: Buffer,
  fileName: string = "reference.wav",
): Promise<{ voiceId: string; voiceName: string }> {
  if (!apiKey) throw new Error("ElevenLabs API key is required to clone a voice.");

  const boundary = `----VerityBoundary${Date.now().toString(16)}`;
  const mimeType = fileName.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

  const parts: Buffer[] = [];
  const addField = (name: string, value: string) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  };

  addField("name", voiceName);
  addField("description", "Cloned voice for VerityAI podcast");

  // File part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(audioBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const bodyBuffer = Buffer.concat(parts);

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voice cloning failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as { voice_id: string };
  return {
    voiceId: data.voice_id,
    voiceName,
  };
}

/**
 * Synthesizes audio using a local KokoClone service endpoint (Kokoro-ONNX + Kanade)
 * or returns a fallback if the local server is not running.
 */
export async function synthesizeKokoClone(
  endpoint: string,
  text: string,
  referenceAudioBase64?: string,
  lang: string = "en",
): Promise<Buffer> {
  const cleanEndpoint = (endpoint || "http://127.0.0.1:7860").replace(/\/+$/, "");

  if (!referenceAudioBase64) {
    throw new Error(
      `KokoClone requires a reference voice sample to clone. Please upload a 3–10 second reference audio clip (.wav or .mp3) for Speaker 1 and Speaker 2 in the Podcast view, or select System Voices in Settings.`,
    );
  }

  // 1. Try Gradio 6 API (upload reference audio + /gradio_api/call/clone_voice)
  try {
    const rawBase64 = referenceAudioBase64.includes(",")
      ? referenceAudioBase64.split(",")[1]
      : referenceAudioBase64;
    const audioBuffer = Buffer.from(rawBase64, "base64");

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("files", blob, "reference.wav");

    const uploadRes = await fetch(`${cleanEndpoint}/gradio_api/upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (uploadRes.ok) {
      const uploadJson = await uploadRes.json();
      const uploadedPath = Array.isArray(uploadJson) ? uploadJson[0] : uploadJson;
      if (uploadedPath) {
        const fileData = { path: uploadedPath, meta: { _type: "gradio.FileData" } };

        const callRes = await fetch(`${cleanEndpoint}/gradio_api/call/clone_voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [text, lang, fileData],
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (callRes.ok) {
          const { event_id } = await callRes.json();
          if (event_id) {
            const streamRes = await fetch(`${cleanEndpoint}/gradio_api/call/clone_voice/${event_id}`, {
              signal: AbortSignal.timeout(120000),
            });
            if (streamRes.ok) {
              const streamText = await streamRes.text();
              const lines = streamText.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const parsed = JSON.parse(line.slice(6));
                    const out = Array.isArray(parsed) ? parsed[0] : parsed;
                    const pathOrUrl = out?.url || out?.path || (typeof out === "string" ? out : null);
                    if (pathOrUrl) {
                      const fileUrl = pathOrUrl.startsWith("http")
                        ? pathOrUrl
                        : `${cleanEndpoint}/gradio_api/file=${pathOrUrl}`;
                      const dlRes = await fetch(fileUrl);
                      if (dlRes.ok) {
                        return Buffer.from(await dlRes.arrayBuffer());
                      }
                    }
                  } catch {
                    // Continue searching subsequent SSE lines
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Gradio 6 protocol attempt failed, try legacy Gradio
  }

  try {
    // 2. Try legacy Gradio /api/predict/ format
    const gradioRes = await fetch(`${cleanEndpoint}/api/predict/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          text,
          lang,
          referenceAudioBase64 ? { data: referenceAudioBase64, name: "reference.wav" } : null,
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (gradioRes.ok) {
      const data = await gradioRes.json();
      const outputUrlOrObj = data.data?.[0];
      if (typeof outputUrlOrObj === "string") {
        const fileUrl = outputUrlOrObj.startsWith("http") ? outputUrlOrObj : `${cleanEndpoint}/file=${outputUrlOrObj}`;
        const fileRes = await fetch(fileUrl);
        if (fileRes.ok) return Buffer.from(await fileRes.arrayBuffer());
      } else if (outputUrlOrObj?.data) {
        return Buffer.from(outputUrlOrObj.data.split(",")[1] || outputUrlOrObj.data, "base64");
      }
    }
  } catch {
    // Legacy Gradio attempt failed, try REST
  }

  try {
    // 3. Try direct REST format /clone
    const restRes = await fetch(`${cleanEndpoint}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        lang,
        reference_audio: referenceAudioBase64,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (restRes.ok) {
      return Buffer.from(await restRes.arrayBuffer());
    }
  } catch (err) {
    throw new Error(
      `Could not connect to KokoClone at ${cleanEndpoint}. Please start the KokoClone server (e.g. "cd kokoclone && .venv/bin/python app.py" on port 7860). Error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  throw new Error(`KokoClone server at ${cleanEndpoint} did not return audio.`);
}
