import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword, requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200),
  role: z.enum(["CEO_ADMIN", "OPERATIONS", "FINANCE"]),
  password: z.string().min(10).max(200),
});

export async function GET() {
  try {
    const user = await requireSession();
    if (user.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode gerenciar usuários.");
    const users = await db.selectFrom("users").select(["id", "name", "email", "role", "active", "must_change_password", "created_at"]).where("org_id", "=", user.orgId).orderBy("name").execute();
    return Response.json({ users: users.map((x) => ({ ...x, active: Boolean(x.active), mustChangePassword: Boolean(x.must_change_password) })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    if (session.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode gerenciar usuários.");
    const body = createSchema.parse(await request.json());
    const duplicate = await db.selectFrom("users").select("id").where("email", "=", body.email.toLowerCase()).executeTakeFirst();
    if (duplicate) throw new HttpError(409, "Já existe um usuário com este e-mail.");
    const id = randomUUID();
    const now = new Date().toISOString();
    await db.insertInto("users").values({ id, org_id: session.orgId, name: body.name, email: body.email.toLowerCase(), password_hash: await hashPassword(body.password), role: body.role, active: 1, must_change_password: 1, created_at: now, updated_at: now }).execute();
    await audit(session.orgId, session.id, "CREATE", "user", id, { role: body.role });
    return Response.json({ user: { id, name: body.name, email: body.email.toLowerCase(), role: body.role, active: true } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
