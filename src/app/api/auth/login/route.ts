import { z } from "zod";
import { authenticate, setSessionCookie } from "@/lib/auth";
import { assertSameOrigin, apiError } from "@/lib/http";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const attempts = new Map<string, { count: number; reset: number }>();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const now = Date.now();
    const state = attempts.get(ip);
    if (state && state.reset > now && state.count >= 8) return Response.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
    const body = schema.parse(await request.json());
    const result = await authenticate(body.email, body.password);
    if (!result) {
      attempts.set(ip, { count: state?.reset && state.reset > now ? state.count + 1 : 1, reset: now + 15 * 60_000 });
      return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }
    attempts.delete(ip);
    await setSessionCookie(result.token, result.expires);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
