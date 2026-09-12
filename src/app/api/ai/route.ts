import type { NextRequest } from "next/server";
import { listModels, ollamaStatus, PROVIDER_PRESETS, pullOllamaModel, testProvider, type Provider, type ProviderConfig } from "@/lib/ai/provider";
import { assertSafeEndpoint, cleanText, fail, HttpError, ok, readJson } from "@/lib/http";
import { getProviderConfig, getSettingsRow, toProviderConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function draftConfig(draft: Record<string, unknown> | undefined): Promise<ProviderConfig> {
  if (!draft) return getProviderConfig();
  const provider = String(draft.provider ?? "none") as Provider;
  if (!(provider in PROVIDER_PRESETS)) throw new HttpError("Choose an AI backend first.");
  const stored = await getSettingsRow();
  const storedKey = toProviderConfig(stored).apiKey;
  const preset = PROVIDER_PRESETS[provider as Exclude<Provider, "none">];
  return {
    provider,
    model: cleanText(draft.model, 160) || preset.model,
    embeddingModel: cleanText(draft.embeddingModel, 160) || preset.embeddingModel,
    endpoint: (cleanText(draft.endpoint, 400) || preset.endpoint).replace(/\/+$/, ""),
    apiKey: cleanText(draft.apiKey, 500) || (stored.provider === provider ? storedKey : ""),
  };
}

function localEndpoint(value: unknown) {
  const endpoint = cleanText(value, 400) || PROVIDER_PRESETS.ollama.endpoint;
  return assertSafeEndpoint(endpoint);
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const action = String(body.action ?? "");

    if (action === "test") {
      const cfg = await draftConfig(body.draft as Record<string, unknown> | undefined);
      return ok(await testProvider(cfg));
    }

    if (action === "list-models") {
      const cfg = await draftConfig(body.draft as Record<string, unknown> | undefined);
      return ok(await listModels(cfg));
    }

    if (action === "ollama-status") {
      return ok(await ollamaStatus(localEndpoint(body.endpoint)));
    }

    if (action === "ollama-pull") {
      const model = cleanText(body.model, 160);
      if (!/^[\w.\-/:]+$/.test(model)) throw new HttpError("Enter a valid model name, e.g. qwen2.5:7b-instruct.");
      const upstream = await pullOllamaModel(localEndpoint(body.endpoint), model);
      return new Response(upstream.body, {
        headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" },
      });
    }

    throw new HttpError("Unsupported action.");
  } catch (error) {
    return fail(error, "The AI backend request failed.");
  }
}
