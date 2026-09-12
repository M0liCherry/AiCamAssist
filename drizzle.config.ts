import { defineConfig } from "drizzle-kit";

/**
 * Dev-only tooling config (`npm run db:generate/push/check/studio`).
 * At runtime the app migrates itself on startup (see src/db), so this file
 * is only used when authoring migrations. Reads DATABASE_URL like the app;
 * falls back to a local database name matching .env.example.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/VerityAI",
  },
});
