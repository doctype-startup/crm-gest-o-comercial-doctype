import { sql } from "kysely";
import { db, ensureSchema } from "@/lib/db";

function safeError(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return {
      name: typeof value.name === "string" ? value.name : "Error",
      code: typeof value.code === "string" ? value.code : undefined,
      message: typeof value.message === "string" ? value.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]") : "Unknown database error",
    };
  }
  return { name: "Error", message: String(error) };
}

export async function GET() {
  try {
    await ensureSchema();
    await sql`select 1`.execute(db);
    return Response.json({ status: "healthy" });
  } catch (error) {
    console.error("Health check database error", error);
    return Response.json({ status: "unhealthy", error: safeError(error) }, { status: 503 });
  }
}
