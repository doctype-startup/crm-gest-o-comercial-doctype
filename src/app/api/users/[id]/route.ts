import { z } from "zod";
import { hashPassword, requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";

const schema = z.object({ name: z.string().trim().min(2).max(200), role: z.enum(["CEO_ADMIN", "OPERATIONS", "FINANCE"]), active: z.boolean(), password: z.string().min(10).max(200).optional().or(z.literal("")) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    if (session.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode gerenciar usuários.");
    const id = (await params).id;
    const body = schema.parse(await request.json());
    if (id === session.id && !body.active) throw new HttpError(400, "Você não pode desativar o próprio usuário.");
    const values: { name: string; role: "CEO_ADMIN" | "OPERATIONS" | "FINANCE"; active: number; updated_at: string; password_hash?: string; must_change_password?: number } = { name: body.name, role: body.role, active: body.active ? 1 : 0, updated_at: new Date().toISOString() };
    if (body.password) { values.password_hash = await hashPassword(body.password); values.must_change_password = 1; }
    const result = await db.updateTable("users").set(values).where("id", "=", id).where("org_id", "=", session.orgId).executeTakeFirst();
    if (!Number(result.numUpdatedRows)) throw new HttpError(404, "Usuário não encontrado.");
    if (!body.active) await db.deleteFrom("sessions").where("user_id", "=", id).execute();
    await audit(session.orgId, session.id, "UPDATE", "user", id, { role: body.role, active: body.active, resetPassword: Boolean(body.password) });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
