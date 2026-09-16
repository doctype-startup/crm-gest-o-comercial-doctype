import { requireSession } from "@/lib/auth";
import { apiError, assertSameOrigin, HttpError } from "@/lib/http";
import { notifyUsers } from "@/lib/notifications";
import { resendIsConfigured } from "@/lib/resend";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    if (user.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode enviar uma notificação de teste.");
    await notifyUsers(user.orgId, [{ id: user.id, name: user.name, email: user.email }], {
      title: "Notificação de teste",
      body: "Se você recebeu isto na central e por e-mail, a integração está funcionando.",
    });
    return Response.json({ ok: true, emailAttempted: resendIsConfigured() });
  } catch (error) { return apiError(error); }
}
