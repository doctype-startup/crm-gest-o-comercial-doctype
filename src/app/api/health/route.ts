import { sql } from "kysely";
import { db, ensureSchema } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    await sql`select 1`.execute(db);
    return Response.json({ status: "healthy" });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
