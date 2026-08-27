import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getAppState } from "@/lib/state";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const ifNoneMatch = request.headers.get("if-none-match") || undefined;
    const result = await getAppState(user, ifNoneMatch);
    if (result.notModified) return new Response(null, { status: 304, headers: { ETag: result.etag } });
    return Response.json(result.body, { headers: { ETag: result.etag } });
  } catch (error) { return apiError(error); }
}
