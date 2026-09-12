import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * VerityAI runs against two interchangeable PostgreSQL-dialect engines:
 *  - Embedded PGlite (default): a local database folder, no server to install.
 *    Used on the desktop (%AppData%\VerityAI via NITRO_DATA_DIR) and whenever
 *    DATABASE_URL is not configured (falls back to ./.nitro).
 *  - PostgreSQL server: used when DATABASE_URL is set and NITRO_DATA_DIR is not.
 * Both share the same Drizzle schema and query code.
 */
export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __nitroDb?: Promise<Database>;
  __nitroPool?: Pool;
};

/** Local data directory (database, encryption key, model cache, logs). */
export function dataDirectory() {
  return path.resolve(process.env.NITRO_DATA_DIR || ".nitro");
}

/** True when running inside the Electron shell (or with an explicit data dir). */
export function isDesktopMode() {
  return process.env.NITRO_DESKTOP === "1" || Boolean(process.env.NITRO_DATA_DIR);
}

/** True when the embedded PGlite engine is used instead of a PostgreSQL server. */
export function usesEmbeddedDatabase() {
  return Boolean(process.env.NITRO_DATA_DIR) || !process.env.DATABASE_URL;
}

async function createEmbedded(): Promise<Database> {
  const dataDir = dataDirectory();
  const databaseDir = path.join(dataDir, "database");
  try {
    // PGlite only creates the final folder itself; make sure every parent exists.
    fs.mkdirSync(databaseDir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(databaseDir);
    await client.waitReady;
    const db = drizzle(client, { schema });
    const migrationsFolder = process.env.NITRO_MIGRATIONS_DIR || path.join(process.cwd(), "drizzle");
    if (!fs.existsSync(migrationsFolder)) {
      throw new Error(`migrations folder not found at ${migrationsFolder}`);
    }
    await migrate(db, { migrationsFolder });
    try {
      await client.exec(`
        ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "elevenlabs_api_key_encrypted" text;
        ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "podcast_audio_engine" varchar(32) DEFAULT 'speechSynthesis' NOT NULL;
        ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "elevenlabs_host_voice" varchar(80) DEFAULT '21m00Tcm4TlvDq8ikWAM' NOT NULL;
        ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "elevenlabs_guest_voice" varchar(80) DEFAULT 'pNInz6obpgDQGcFmaJgB' NOT NULL;
        ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "kokoclone_endpoint" varchar(255) DEFAULT 'http://127.0.0.1:7860' NOT NULL;
      `);
    } catch {
      // Ignored if table not created yet or already up to date
    }
    return db as unknown as Database;
  } catch (error) {
    const err = error as { message?: string; cause?: { message?: string } };
    const reason = [err?.message, err?.cause?.message].filter(Boolean).join(" — ") || String(error);
    throw new Error(`The embedded database in ${dataDir} could not be opened: ${reason}. Check that the folder is writable, close other VerityAI instances using it, or delete its "database" sub-folder to start fresh.`);
  }
}

async function createDatabase(): Promise<Database> {
  if (usesEmbeddedDatabase()) return createEmbedded();
  const pool = globalForDb.__nitroPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
  globalForDb.__nitroPool = pool;
  return drizzleNodePg(pool, { schema });
}

/** Lazily initialises (and migrates, in embedded mode) the shared database. */
export function getDb(): Promise<Database> {
  if (!globalForDb.__nitroDb) {
    globalForDb.__nitroDb = createDatabase().catch((error) => {
      globalForDb.__nitroDb = undefined;
      throw error;
    });
  }
  return globalForDb.__nitroDb;
}
