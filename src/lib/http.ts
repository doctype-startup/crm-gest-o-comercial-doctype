import { z } from "zod";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  if (new URL(origin).host !== expectedHost) {
    throw new HttpError(403, "Origem da solicitação não permitida.");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number" && "message" in error) {
    return Response.json({ error: String(error.message) }, { status: error.status });
  }
  if (error instanceof z.ZodError) return Response.json({ error: "Revise os campos informados.", fields: z.flattenError(error).fieldErrors }, { status: 400 });
  if (error instanceof SyntaxError) return Response.json({ error: "JSON inválido." }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}
