import { put } from "@vercel/blob";

// Arquivos (contratos, logos) chegam como data URL base64 vindos do navegador. Guardar
// isso direto na coluna `data` da tabela `records` infla uma tabela que é lida por
// inteiro a cada poll do DOC Monitor. Quando BLOB_READ_WRITE_TOKEN está configurado,
// arquivos acima do limiar são enviados ao Vercel Blob e só a URL fica no registro.
// Sem o token (dev/test/preview sem storage configurado), o comportamento antigo é
// preservado — o arquivo continua inline. Isso é intencional: nenhuma configuração
// nova é exigida para rodar localmente ou nos testes existentes.
const MIN_SIZE_TO_EXTERNALIZE = 20_000;

export function blobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function parseDataUrl(value: string) {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(value);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

export async function externalizeDataUrl(value: unknown, pathHint: string): Promise<unknown> {
  if (typeof value !== "string" || !blobStorageConfigured()) return value;
  if (!value.startsWith("data:") || value.length < MIN_SIZE_TO_EXTERNALIZE) return value;
  const parsed = parseDataUrl(value);
  if (!parsed) return value;
  try {
    const buffer = Buffer.from(parsed.base64, "base64");
    const extension = parsed.mime.split("/")[1]?.split("+")[0]?.replace(/[^a-z0-9]/gi, "") || "bin";
    const blob = await put(`${pathHint}.${extension}`, buffer, {
      access: "public",
      contentType: parsed.mime,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (error) {
    console.error("Falha ao enviar arquivo para o Vercel Blob; mantendo inline nesta gravação.", error);
    return value;
  }
}
