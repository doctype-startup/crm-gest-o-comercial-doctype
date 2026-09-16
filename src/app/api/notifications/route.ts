import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireSession();
    const rows = await db
      .selectFrom("notifications")
      .select(["id", "title", "body", "link", "read", "created_at"])
      .where("org_id", "=", user.orgId)
      .where("user_id", "=", user.id)
      .orderBy("created_at", "desc")
      .limit(30)
      .execute();
    const unread = await db
      .selectFrom("notifications")
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .where("org_id", "=", user.orgId)
      .where("user_id", "=", user.id)
      .where("read", "=", 0)
      .executeTakeFirstOrThrow();
    return Response.json({
      notifications: rows.map((row) => ({ id: row.id, title: row.title, body: row.body, link: row.link, read: Boolean(row.read), createdAt: row.created_at })),
      unreadCount: Number(unread.count),
    });
  } catch (error) { return apiError(error); }
}
