export async function prepareProductImage(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw new Error("Usa JPG, PNG o WebP de hasta 15 MiB");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la imagen");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("No se pudo comprimir la imagen")),
        "image/webp",
        0.85
      )
    );
    canvas.width = canvas.height = 0;
    if (
      !blob.size ||
      blob.size > 5 * 1024 * 1024 ||
      !["image/webp", "image/png", "image/jpeg"].includes(blob.type)
    )
      throw new Error(
        "La imagen procesada debe ser JPG, PNG o WebP de hasta 5 MiB"
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
