import { z } from "zod";
import { requireSession, setSessionCookie } from "@/lib/auth";
import { passwordSchema } from "@/lib/account-security";
import { audit } from "@/lib/db";
import { assertSameOrigin, apiError } from "@/lib/http";
import { updateManagedUser } from "@/lib/user-management";

const schema = z.object({ name: z.string().trim().min(2).max(200), role: z.enum(["CEO_ADMIN", "OPERATIONS", "FINANCE"]), active: z.boolean(), password: passwordSchema.optional().or(z.literal("")) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const id = (await params).id;
    const body = schema.parse(await request.json());
    const result = await updateManagedUser(session, id, { ...body, password: body.password || undefined });
    if (result.session) await setSessionCookie(result.session.token, result.session.expires);
    await audit(session.orgId, session.id, "UPDATE", "user", id, { role: body.role, active: body.active, resetPassword: Boolean(body.password) });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
