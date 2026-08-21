import { logout } from "@/lib/auth";
import { assertSameOrigin, apiError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await logout();
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
