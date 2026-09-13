import { defineConfig } from "drizzle-kit";

/**
 * Used with `npx drizzle-kit generate|migrate|push|studio`.
 * Points at DATABASE_URL when set (hosted PostgreSQL, e.g. for Vercel),
 * otherwise falls back to a local development database.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
