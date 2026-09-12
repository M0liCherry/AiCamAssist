import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { generatedAssets } from "@/db/schema";
import { fail, HttpError, ok, readJson } from "@/lib/http";
import {
  podcastAudioDir,
  synthesizeElevenLabsTurn,
  synthesizeKokoClone,
} from "@/lib/podcast/audio";
import { getKokoclonePaths } from "@/lib/podcast/kokoclone-manager";
import { getPodcastAudioConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const assetId = searchParams.get("assetId");
    const file = searchParams.get("file") || "full_episode.mp3";
    const download = searchParams.get("download") === "1";

    if (!assetId) throw new HttpError("Asset ID is required.", 400);

    // Sanitize filename to prevent directory traversal
    const safeFile = path.basename(file);
    const filePath = path.join(podcastAudioDir(assetId), safeFile);

    if (!fs.existsSync(filePath)) {
      throw new HttpError("Audio file not found.", 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    const mimeType = safeFile.endsWith(".wav") ? "audio/wav" : "audio/mpeg";

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || end >= fileSize) {
        return new Response("Requested range not satisfiable.", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(fileStream);

      const headers = new Headers({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": mimeType,
      });

      return new Response(webStream as unknown as ReadableStream, {
        status: 206,
        headers,
      });
    }

    const fileStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(fileStream);
    const headers = new Headers({
      "Content-Length": String(fileSize),
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });

    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${safeFile}"`);
    }

    return new Response(webStream as unknown as ReadableStream, { headers });
  } catch (error) {
    return fail(error, "Failed to load audio file.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const assetId = Number(body.assetId);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      throw new HttpError("Valid assetId is required.", 400);
    }

    const db = await getDb();
    const [asset] = await db
      .select()
      .from(generatedAssets)
      .where(eq(generatedAssets.id, assetId))
      .limit(1);

    if (!asset || asset.kind !== "podcast") {
      throw new HttpError("Podcast asset not found.", 404);
    }

    const script = asset.payload as {
      title: string;
      summary: string;
      turns: Array<{ speaker: "host" | "guest"; text: string; audioUrl?: string }>;
      audioUrl?: string;
    };

    if (!script || !Array.isArray(script.turns) || script.turns.length === 0) {
      throw new HttpError("Podcast script has no turns to synthesize.", 400);
    }

    const config = await getPodcastAudioConfig();
    const rawEngine = body.engine || config.engine || "speechSynthesis";
    if (rawEngine !== "elevenlabs" && rawEngine !== "kokoclone") {
      throw new HttpError(
        rawEngine === "speechSynthesis"
          ? "Browser speech synthesis runs on your device — there is no server audio to generate."
          : "Unknown podcast audio engine.",
        400,
      );
    }
    const engine = rawEngine;
    const apiKey = (body.apiKey ? String(body.apiKey).trim() : "") || config.elevenLabsApiKey;
    const hostVoice = body.hostVoice ? String(body.hostVoice) : config.elevenLabsHostVoice;
    const guestVoice = body.guestVoice ? String(body.guestVoice) : config.elevenLabsGuestVoice;
    const kokoEndpoint = body.kokoCloneEndpoint ? String(body.kokoCloneEndpoint) : config.kokoCloneEndpoint;

    const hostRefAudio = body.hostRefAudio ? String(body.hostRefAudio) : undefined;
    const guestRefAudio = body.guestRefAudio ? String(body.guestRefAudio) : undefined;

    // Resolve reference audio for KokoClone (fall back to bundled sample voices if not uploaded)
    const kokoPaths = getKokoclonePaths();
    const defaultHostVoicePath = path.join(kokoPaths.kokoDir, "Voices", "sera.mp3");
    const defaultGuestVoicePath = path.join(kokoPaths.kokoDir, "Voices", "Yumeko.mp3");

    let effectiveHostRefAudio = hostRefAudio;
    if (!effectiveHostRefAudio && fs.existsSync(defaultHostVoicePath)) {
      effectiveHostRefAudio = `data:audio/mp3;base64,${fs.readFileSync(defaultHostVoicePath).toString("base64")}`;
    }

    let effectiveGuestRefAudio = guestRefAudio;
    if (!effectiveGuestRefAudio && fs.existsSync(defaultGuestVoicePath)) {
      effectiveGuestRefAudio = `data:audio/mp3;base64,${fs.readFileSync(defaultGuestVoicePath).toString("base64")}`;
    } else if (!effectiveGuestRefAudio && effectiveHostRefAudio) {
      effectiveGuestRefAudio = effectiveHostRefAudio;
    }

    if (engine === "elevenlabs" && !apiKey) {
      throw new HttpError("ElevenLabs API key is required. Please provide it in the prompt or in Settings.", 400);
    }

    const rawStart = typeof body.startTurn === "number" ? Math.max(0, Math.floor(body.startTurn)) : 0;
    const rawEnd = typeof body.endTurn === "number" ? Math.min(script.turns.length, Math.floor(body.endTurn)) : script.turns.length;
    const startTurn = Math.min(rawStart, script.turns.length);
    const endTurn = Math.max(startTurn, rawEnd);

    const dir = podcastAudioDir(assetId);
    const turnAudioBuffers: Map<number, Buffer> = new Map();
    const updatedTurns = [...script.turns];

    // 1. Synthesize turns in the requested section
    for (let i = startTurn; i < endTurn; i++) {
      const turn = script.turns[i];
      const isHost = turn.speaker === "host";
      let turnBuffer: Buffer;

      if (engine === "elevenlabs") {
        const voiceId = isHost ? hostVoice : guestVoice;
        turnBuffer = await synthesizeElevenLabsTurn(apiKey, voiceId, turn.text);
      } else {
        const refAudio = isHost ? effectiveHostRefAudio : (effectiveGuestRefAudio || effectiveHostRefAudio);
        turnBuffer = await synthesizeKokoClone(kokoEndpoint, turn.text, refAudio);
      }

      const turnFilename = `turn_${i}.mp3`;
      fs.writeFileSync(path.join(dir, turnFilename), turnBuffer);
      turnAudioBuffers.set(i, turnBuffer);

      updatedTurns[i] = {
        ...turn,
        audioUrl: `/api/podcast/audio?assetId=${assetId}&file=${turnFilename}`,
      };
    }

    // 2. Read any already existing turn audio files from disk for other turns
    for (let i = 0; i < script.turns.length; i++) {
      if (turnAudioBuffers.has(i)) continue;

      const turnFilename = `turn_${i}.mp3`;
      const turnPath = path.join(dir, turnFilename);
      if (fs.existsSync(turnPath)) {
        try {
          const buf = fs.readFileSync(turnPath);
          if (buf.length > 0) {
            turnAudioBuffers.set(i, buf);
            updatedTurns[i] = {
              ...script.turns[i],
              audioUrl: `/api/podcast/audio?assetId=${assetId}&file=${turnFilename}`,
            };
          }
        } catch {
          // Ignore read error
        }
      }
    }

    // 3. Concatenate all contiguous or available turn MP3 buffers into an episode MP3
    const sortedBuffers: Buffer[] = [];
    for (let i = 0; i < script.turns.length; i++) {
      const buf = turnAudioBuffers.get(i);
      if (buf) sortedBuffers.push(buf);
    }

    let fullEpisodeUrl = script.audioUrl || null;
    if (sortedBuffers.length > 0) {
      const fullEpisodeBuffer = Buffer.concat(sortedBuffers);
      fs.writeFileSync(path.join(dir, "full_episode.mp3"), fullEpisodeBuffer);
      fullEpisodeUrl = `/api/podcast/audio?assetId=${assetId}&file=full_episode.mp3&v=${Date.now()}`;
    }

    // Persist audio URLs onto the asset payload
    const updatedPayload = {
      ...script,
      audioUrl: fullEpisodeUrl,
      turns: updatedTurns,
      audioEngine: engine,
      audioGeneratedAt: new Date().toISOString(),
    };

    await db
      .update(generatedAssets)
      .set({ payload: updatedPayload })
      .where(eq(generatedAssets.id, assetId));

    return ok({
      audioUrl: fullEpisodeUrl,
      turns: updatedTurns,
      engine,
      startTurn,
      endTurn,
      generatedSectionTurnCount: endTurn - startTurn,
      totalTurns: script.turns.length,
      completedTurnsCount: updatedTurns.filter((t) => t.audioUrl).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate podcast audio.";
    return fail(error, message);
  }
}
