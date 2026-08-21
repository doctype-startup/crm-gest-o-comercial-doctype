import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";

const allowed = new Set(["doctype-logo.svg", "doctype-d-mark.png", "doc-mascote.svg"]);

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;
  if (!allowed.has(name)) notFound();
  const body = await readFile(join(process.cwd(), "assets", name));
  const contentType = name.endsWith(".png") ? "image/png" : "image/svg+xml";
  return new Response(body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
}
