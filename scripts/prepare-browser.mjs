import { access, chmod, mkdir } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrotliDecompress } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { extract } from "tar-fs";

const tempRoot = process.env.TMPDIR || "/tmp/doctype-browser";
const packageEntry = fileURLToPath(import.meta.resolve("@sparticuz/chromium"));
const bin = join(dirname(dirname(packageEntry)), "bin");

await mkdir(tempRoot, { recursive: true });
await mkdir(join(tempRoot, "cache"), { recursive: true });

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function inflateFile(source, target) {
  if (!(await exists(target))) await pipeline(createReadStream(source), createBrotliDecompress(), createWriteStream(target, { mode: 0o700 }));
}

async function inflateArchive(source, target, marker) {
  await mkdir(target, { recursive: true });
  if (!(await exists(join(target, marker)))) await pipeline(createReadStream(source), createBrotliDecompress(), extract(target, { chown: false }));
}

await inflateFile(join(bin, "chromium.br"), join(tempRoot, "chromium"));
await chmod(join(tempRoot, "chromium"), 0o700);
await inflateArchive(join(bin, "fonts.tar.br"), join(tempRoot, "fonts"), "fonts.conf");
await inflateArchive(join(bin, "swiftshader.tar.br"), tempRoot, "libGLESv2.so");
await inflateArchive(join(bin, "al2023.tar.br"), join(tempRoot, "al2023"), "lib/libnss3.so");

console.log(`Navegador preparado em ${tempRoot}`);
