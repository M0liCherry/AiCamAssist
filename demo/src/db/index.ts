import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Verity runs against two interchangeable PostgreSQL-dialect engines:
 *  - Embedded PGlite (default): a local database folder, no server to install.
 *    Used on the desktop (%AppData%\Verity via VERITY_DATA_DIR / NITRO_DATA_DIR) and whenever
 *    DATABASE_URL is not configured (falls back to ./.verity or ./.nitro).
 *  - PostgreSQL server: used when DATABASE_URL is set and data dir is not.
 * Both share the same Drizzle schema and query code.
 */
export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __verityDb?: Promise<Database>;
  __verityPool?: Pool;
  __nitroDb?: Promise<Database>;
  __nitroPool?: Pool;
};

/** Local data directory (database, encryption key, model cache, logs). */
export function dataDirectory() {
  return path.resolve(process.env.VERITY_DATA_DIR || process.env.NITRO_DATA_DIR || (fs.existsSync(".verity") ? ".verity" : fs.existsSync(".nitro") ? ".nitro" : ".verity"));
}

/** True when running inside the Electron shell (or with an explicit data dir). */
export function isDesktopMode() {
  return process.env.VERITY_DESKTOP === "1" || process.env.NITRO_DESKTOP === "1" || Boolean(process.env.VERITY_DATA_DIR || process.env.NITRO_DATA_DIR);
}

/** True when the embedded PGlite engine is used instead of a PostgreSQL server. */
export function usesEmbeddedDatabase() {
  return Boolean(process.env.VERITY_DATA_DIR || process.env.NITRO_DATA_DIR) || !process.env.DATABASE_URL;
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
    const migrationsFolder = process.env.VERITY_MIGRATIONS_DIR || process.env.NITRO_MIGRATIONS_DIR || path.join(process.cwd(), "drizzle");
    if (!fs.existsSync(migrationsFolder)) {
      throw new Error(`migrations folder not found at ${migrationsFolder}`);
    }
    await migrate(db, { migrationsFolder });
    return db as unknown as Database;
  } catch (error) {
    const err = error as { message?: string; cause?: { message?: string } };
    const reason = [err?.message, err?.cause?.message].filter(Boolean).join(" — ") || String(error);
    throw new Error(`The embedded database in ${dataDir} could not be opened: ${reason}. Check that the folder is writable, close other Verity instances using it, or delete its "database" sub-folder to start fresh.`);
  }
}

async function createDatabase(): Promise<Database> {
  if (usesEmbeddedDatabase()) return createEmbedded();
  const pool = globalForDb.__verityPool ?? globalForDb.__nitroPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
  globalForDb.__verityPool = pool;
  globalForDb.__nitroPool = pool;
  return drizzleNodePg(pool, { schema });
}

/** Lazily initialises (and migrates, in embedded mode) the shared database. */
export function getDb(): Promise<Database> {
  const cached = globalForDb.__verityDb ?? globalForDb.__nitroDb;
  if (!cached) {
    const dbPromise = createDatabase().catch((error) => {
      globalForDb.__verityDb = undefined;
      globalForDb.__nitroDb = undefined;
      throw error;
    });
    globalForDb.__verityDb = dbPromise;
    globalForDb.__nitroDb = dbPromise;
    return dbPromise;
  }
  return cached;
}
