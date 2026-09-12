import fs from "node:fs";
import path from "node:path";
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
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      const headers = new Headers({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": mimeType,
      });

      return new Response(fileStream as unknown as ReadableStream, {
        status: 206,
        headers,
      });
    }

    const fileStream = fs.createReadStream(filePath);
    const headers = new Headers({
      "Content-Length": String(fileSize),
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
    });

    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${safeFile}"`);
    }

    return new Response(fileStream as unknown as ReadableStream, { headers });
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
    };

    if (!script || !Array.isArray(script.turns) || script.turns.length === 0) {
      throw new HttpError("Podcast script has no turns to synthesize.", 400);
    }

    const config = await getPodcastAudioConfig();
    const engine = (body.engine || config.engine || "elevenlabs") as "elevenlabs" | "kokoclone";
    const apiKey = (body.apiKey ? String(body.apiKey).trim() : "") || config.elevenLabsApiKey;
    const hostVoice = body.hostVoice ? String(body.hostVoice) : config.elevenLabsHostVoice;
    const guestVoice = body.guestVoice ? String(body.guestVoice) : config.elevenLabsGuestVoice;
    const kokoEndpoint = body.kokoCloneEndpoint ? String(body.kokoCloneEndpoint) : config.kokoCloneEndpoint;

    const hostRefAudio = body.hostRefAudio ? String(body.hostRefAudio) : undefined;
    const guestRefAudio = body.guestRefAudio ? String(body.guestRefAudio) : undefined;

    if (engine === "elevenlabs" && !apiKey) {
      throw new HttpError("ElevenLabs API key is required. Please provide it in the prompt or in Settings.", 400);
    }

    const dir = podcastAudioDir(assetId);
    const turnAudioBuffers: Buffer[] = [];
    const updatedTurns = [];

    for (let i = 0; i < script.turns.length; i++) {
      const turn = script.turns[i];
      const isHost = turn.speaker === "host";
      let turnBuffer: Buffer;

      if (engine === "elevenlabs") {
        const voiceId = isHost ? hostVoice : guestVoice;
        turnBuffer = await synthesizeElevenLabsTurn(apiKey, voiceId, turn.text);
      } else {
        const refAudio = isHost ? hostRefAudio : (guestRefAudio || hostRefAudio);
        turnBuffer = await synthesizeKokoClone(kokoEndpoint, turn.text, refAudio);
      }

      const turnFilename = `turn_${i}.mp3`;
      fs.writeFileSync(path.join(dir, turnFilename), turnBuffer);
      turnAudioBuffers.push(turnBuffer);

      updatedTurns.push({
        ...turn,
        audioUrl: `/api/podcast/audio?assetId=${assetId}&file=${turnFilename}`,
      });
    }

    // Concatenate all turn MP3 buffers into a complete episode MP3
    const fullEpisodeBuffer = Buffer.concat(turnAudioBuffers);
    fs.writeFileSync(path.join(dir, "full_episode.mp3"), fullEpisodeBuffer);

    const fullEpisodeUrl = `/api/podcast/audio?assetId=${assetId}&file=full_episode.mp3`;

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
      totalTurns: updatedTurns.length,
    });
  } catch (error) {
    return fail(error, "Failed to generate podcast audio.");
  }
}
