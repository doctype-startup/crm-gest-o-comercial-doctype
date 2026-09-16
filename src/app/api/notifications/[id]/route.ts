import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, assertSameOrigin } from "@/lib/http";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    const { id } = await params;
    await db.updateTable("notifications").set({ read: 1 }).where("id", "=", id).where("org_id", "=", user.orgId).where("user_id", "=", user.id).execute();
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
