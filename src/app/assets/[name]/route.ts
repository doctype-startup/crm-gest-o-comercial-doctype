import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";

const legacyAssets = new Set(["doctype-logo.svg", "doctype-d-mark.png", "doc-mascote.svg"]);
const publicAssets = new Set([
  "guardiao-alerta.webp",
  "guardiao-suporte.webp",
]);

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;
  if (!legacyAssets.has(name) && !publicAssets.has(name)) notFound();
  const directory = publicAssets.has(name) ? join(process.cwd(), "public", "assets") : join(process.cwd(), "assets");
  const body = await readFile(join(directory, name));
  const contentType = name.endsWith(".webp") ? "image/webp" : name.endsWith(".png") ? "image/png" : "image/svg+xml";
  return new Response(body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
}
