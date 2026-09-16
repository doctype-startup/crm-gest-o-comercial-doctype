import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, assertSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    await db.updateTable("notifications").set({ read: 1 }).where("org_id", "=", user.orgId).where("user_id", "=", user.id).where("read", "=", 0).execute();
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
