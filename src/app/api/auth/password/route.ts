import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { passwordSchema } from "@/lib/account-security";
import { hashPassword, requireSession, rotateUserSessions, setSessionCookie } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";

const schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const body = schema.parse(await request.json());
    const user = await db.selectFrom("users").select(["password_hash"]).where("id", "=", session.id).executeTakeFirstOrThrow();
    if (!(await verify(user.password_hash, body.currentPassword))) throw new HttpError(400, "A senha atual está incorreta.");
    if (await verify(user.password_hash, body.newPassword)) throw new HttpError(400, "A nova senha deve ser diferente da senha atual.");
    const passwordHash = await hashPassword(body.newPassword);
    const rotated = await db.transaction().execute(async (trx) => {
      await trx.updateTable("users").set({ password_hash: passwordHash, must_change_password: 0, updated_at: new Date().toISOString() }).where("id", "=", session.id).execute();
      return rotateUserSessions(session.id, trx);
    });
    await setSessionCookie(rotated.token, rotated.expires);
    await audit(session.orgId, session.id, "PASSWORD_CHANGE", "user", session.id);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
