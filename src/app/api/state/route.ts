import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getAppState } from "@/lib/state";

export async function GET() {
  try {
    const user = await requireSession();
    return Response.json(await getAppState(user));
  } catch (error) { return apiError(error); }
}
