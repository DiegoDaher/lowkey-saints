import { AppError } from "./domain.ts";

export const JSON_BODY_LIMIT = 200_000;
export const IMAGE_BODY_LIMIT = 5 * 1024 * 1024;

/** Bound retained bytes even when Content-Length is absent or understated. */
export async function readLimitedBody(
  req: Request,
  limit: number,
  message = "Solicitud demasiado grande"
): Promise<Uint8Array> {
  const length = req.headers.get("content-length");
  if (
    length !== null &&
    /^\d+$/.test(length) &&
    BigInt(length) > BigInt(limit)
  ) {
    await req.body?.cancel().catch(() => undefined);
    throw new AppError(413, message);
  }
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new AppError(413, message);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readJsonBody(req: Request): Promise<unknown> {
  const bytes = await readLimitedBody(req, JSON_BODY_LIMIT);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError(400, "JSON inválido");
  }
}
