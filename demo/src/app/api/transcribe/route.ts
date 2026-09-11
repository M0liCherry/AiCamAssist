import path from "node:path";
import type { NextRequest } from "next/server";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { STT_MODELS } from "@/config/app";
import { fail, HttpError, ok } from "@/lib/http";
import { dataDirectory, getSettingsRow } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Local speech-to-text. The renderer decodes the audio file to 16 kHz mono PCM
 * (Web Audio API) and posts raw Float32 samples; Whisper runs here through
 * Transformers.js/ONNX Runtime on the user's CPU. Model weights are downloaded
 * once into the data directory and reused offline afterwards.
 */
const globalStt = globalThis as typeof globalThis & {
  __verityStt?: { model: string; pipe: Promise<AutomaticSpeechRecognitionPipeline> };
  __nitroStt?: { model: string; pipe: Promise<AutomaticSpeechRecognitionPipeline> };
};

async function loadTranscriber(model: string) {
  const cached = globalStt.__verityStt ?? globalStt.__nitroStt;
  if (cached?.model === model) return cached.pipe;
  const pipe = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = path.join(dataDirectory(), "models");
    env.allowLocalModels = true;
    try {
      return await pipeline("automatic-speech-recognition", model);
    } catch (error) {
      throw new HttpError(
        `The speech model "${model}" could not be loaded. The first transcription needs an internet connection to download it (~75–250 MB); afterwards it works offline. ${error instanceof Error ? error.message : ""}`.trim(),
        503,
      );
    }
  })();
  globalStt.__verityStt = { model, pipe };
  globalStt.__nitroStt = { model, pipe };
  pipe.catch(() => {
    globalStt.__verityStt = undefined;
    globalStt.__nitroStt = undefined;
  });
  return pipe;
}

export async function POST(request: NextRequest) {
  try {
    const sampleRate = Number(request.headers.get("x-verity-sample-rate") ?? request.headers.get("x-nitro-sample-rate") ?? 0);
    if (sampleRate !== 16000) throw new HttpError("Audio must be resampled to 16 kHz mono before transcription.");
    const language = (request.headers.get("x-verity-language") ?? request.headers.get("x-nitro-language") ?? "").trim().toLowerCase().slice(0, 8) || undefined;
    const buffer = await request.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength % 4 !== 0) throw new HttpError("The audio payload is empty or malformed.");
    if (buffer.byteLength > 16000 * 4 * 60 * 6) throw new HttpError("Send at most six minutes of audio per request.");

    const settingsRow = await getSettingsRow();
    const model = STT_MODELS.includes(settingsRow.sttModel) ? settingsRow.sttModel : STT_MODELS[1];
    const transcriber = await loadTranscriber(model);
    const samples = new Float32Array(buffer);
    const englishOnly = model.endsWith(".en");
    const output = (await transcriber(samples, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
      ...(language && !englishOnly ? { language, task: "transcribe" as const } : {}),
    })) as { text?: string } | { text?: string }[];
    const text = (Array.isArray(output) ? output.map((o) => o.text ?? "").join(" ") : output.text ?? "").trim();
    return ok({ text, model });
  } catch (error) {
    return fail(error, "Transcription failed. Check that the speech model downloaded correctly.");
  }
}
