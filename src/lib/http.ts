import { NextResponse } from "next/server";
import { ProviderError } from "@/lib/ai/provider";
import { recordDiagnostic } from "@/lib/settings";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export type ScopeType = "chapter" | "subject";
export type Scope = { scopeType: ScopeType; scopeId: number };

/**
 * API envelope convention (see issue #7):
 * - Success: `ok(data)` with operation-specific keys (e.g. `{note}`, `{subjects}`,
 *   `{attempts}`). Shapes differ per action by design; clients read the keys they asked for.
 * - Failure: always `{ error[, code, suggestedModel] }` via `fail()` / `HttpError` /
 *   `ProviderError` — never a raw `Response.json` error and never a bare 500.
 * - Status probes (Ollama status, KokoClone test, `kokoStatus`) return 200 with
 *   `{ running: boolean, ... }` flags instead of error statuses: "offline" is data, not failure.
 * - Byte streams (podcast audio, Ollama pull NDJSON, subject export) and the 416
 *   plain-text range response use raw `Response` by design — they are not JSON.
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Maps known error classes to user-facing messages and logs unexpected ones (opt-in, local). */
export function fail(error: unknown, fallback = "The request could not be completed.", status = 500) {
  if (error instanceof ProviderError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.suggestedModel ? { suggestedModel: error.suggestedModel } : {}) },
      { status: error.status },
    );
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  void recordDiagnostic(fallback, error);
  return NextResponse.json({ error: fallback }, { status });
}

export function requireInt(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) throw new HttpError(`${label} is required.`);
  return num;
}

export function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const BLOCKED_ENDPOINT_HOSTS = new Set(["169.254.169.254", "100.100.100.100", "metadata.google", "metadata.google.internal", "metadata.azure.com"]);

/**
 * Rejects endpoint URLs that could turn the server into an SSRF proxy:
 * non-HTTP schemes, embedded credentials, and cloud metadata endpoints.
 * Local/LAN model servers remain allowed (documented llama.cpp use case).
 */
export function assertSafeEndpoint(raw: string, label = "endpoint"): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(`The ${label} is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError(`The ${label} must start with http:// or https://.`);
  if (url.username || url.password) throw new HttpError(`The ${label} must not contain credentials.`);
  const host = url.hostname.toLowerCase();
  if (BLOCKED_ENDPOINT_HOSTS.has(host) || host.startsWith("169.254.")) {
    throw new HttpError(`The ${label} points to a cloud metadata service and is not allowed.`);
  }
  return raw.replace(/\/+$/, "");
}

export function parseScope(type: unknown, id: unknown): Scope {
  if (type !== "chapter" && type !== "subject") throw new HttpError("A valid scope (chapter or subject) is required.");
  return { scopeType: type, scopeId: requireInt(id, "Scope id") };
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new HttpError("The request body must be valid JSON.");
  }
}
