import { z } from "zod";
import { clearLoginFailures, loginThrottleIdentifiers, loginThrottleStatus, registerLoginFailure } from "@/lib/account-security";
import { authenticate, setSessionCookie } from "@/lib/auth";
import { assertSameOrigin, apiError } from "@/lib/http";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = schema.parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const identifiers = loginThrottleIdentifiers(ip, body.email);
    const throttle = await loginThrottleStatus(identifiers);
    if (throttle.blocked) {
      return Response.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } },
      );
    }
    const result = await authenticate(body.email, body.password);
    if (!result) {
      await registerLoginFailure(identifiers);
      return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }
    await clearLoginFailures(identifiers);
    await setSessionCookie(result.token, result.expires);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
