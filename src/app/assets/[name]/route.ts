import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";

const allowed = new Set(["doctype-logo.svg", "doc-mascote.svg"]);

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;
  if (!allowed.has(name)) notFound();
  const body = await readFile(join(process.cwd(), "assets", name));
  return new Response(body, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" } });
}
