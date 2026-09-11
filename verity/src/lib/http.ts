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
