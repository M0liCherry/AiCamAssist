import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return ok({ ok: true });
  } catch (error) {
    return fail(error, "Database is unreachable.", 503);
  }
}
