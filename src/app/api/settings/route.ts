import { requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";
import { invalidateState } from "@/lib/state-cache";
import { z } from "zod";

const schema = z.object({ crmGoal: z.coerce.number().min(0).max(100_000_000) });

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    if (user.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode alterar configurações.");
    const body = schema.parse(await request.json());
    const now = new Date().toISOString();
    const current = await db.selectFrom("settings").select("key").where("org_id", "=", user.orgId).where("key", "=", "crmGoal").executeTakeFirst();
    if (current) await db.updateTable("settings").set({ value: JSON.stringify(body.crmGoal), updated_at: now }).where("org_id", "=", user.orgId).where("key", "=", "crmGoal").execute();
    else await db.insertInto("settings").values({ org_id: user.orgId, key: "crmGoal", value: JSON.stringify(body.crmGoal), updated_at: now }).execute();
    await audit(user.orgId, user.id, "UPDATE", "settings", "crmGoal");
    invalidateState(user.orgId);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
