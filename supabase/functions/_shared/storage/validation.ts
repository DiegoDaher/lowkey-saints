import { AppError } from "../domain.ts";
import { IMAGE_BODY_LIMIT } from "../request-body.ts";

export function imageExtension(bytes: Uint8Array, type: string | null) {
  if (bytes.length > IMAGE_BODY_LIMIT)
    throw new AppError(413, "Máximo 5 MiB por imagen");
  const ext =
    type === "image/jpeg"
      ? "jpg"
      : type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : null;
  const valid =
    ext === "jpg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : ext === "png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : ext === "webp"
          ? bytes.length >= 12 &&
            new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
            new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
          : false;
  if (!ext || !valid)
    throw new AppError(400, "Usa una imagen JPG, PNG o WebP válida");
  return ext;
}
