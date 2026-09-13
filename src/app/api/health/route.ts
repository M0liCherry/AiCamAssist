import { getDb, usesEmbeddedDatabase } from "@/db";
import { sql } from "drizzle-orm";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Scrub credentials before an error message ever leaves the server. */
function sanitize(message: string): string {
  return message
    .replace(/:\/\/[^/\s@]+:[^/\s@]+@/g, "://***:***@")
    .replace(/password=[^&\s;]+/gi, "password=***")
    .slice(0, 500);
}

export async function GET() {
  const embedded = usesEmbeddedDatabase();
  const diagnosis: {
    ok: boolean;
    engine: "embedded-pglite" | "postgres-server";
    databaseUrlSet: boolean;
    reachable: boolean;
    settingsTable: boolean;
    error?: string;
  } = {
    ok: false,
    engine: embedded ? "embedded-pglite" : "postgres-server",
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
    reachable: false,
    settingsTable: false,
  };
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    diagnosis.reachable = true;
    try {
      await db.execute(sql`select count(*) from settings`);
      diagnosis.settingsTable = true;
      diagnosis.ok = true;
    } catch (tableError) {
      diagnosis.error = `reachable, but the settings table is missing (run migrations): ${sanitize(tableError instanceof Error ? tableError.message : String(tableError))}`;
    }
  } catch (error) {
    diagnosis.error = sanitize(error instanceof Error ? error.message : String(error));
  }
  return ok(diagnosis, diagnosis.ok ? 200 : 503);
}
