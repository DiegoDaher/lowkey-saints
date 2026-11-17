import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = new URL("../prisma/products/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8")
);
await mkdir(new URL("prepared/", root), { recursive: true });
for (const product of manifest.products) {
  for (const im of product.images) {
    let pipeline = sharp(await readFile(new URL(im.source, root))).rotate();
    let { width, height } = await pipeline.metadata();
    if (im.crop) {
      const [left, top, w, h] = im.crop;
      pipeline = pipeline.extract({ left, top, width: w, height: h });
      width = w;
      height = h;
    }
    // Pad to 4:5, matching the shop's object-cover frames, without upscaling.
    const targetWidth = Math.max(width, Math.ceil((height * 4) / 5));
    const targetHeight = Math.ceil((targetWidth * 5) / 4);
    const horizontal = targetWidth - width;
    const vertical = targetHeight - height;
    await pipeline
      .extend({
        left: Math.floor(horizontal / 2),
        right: Math.ceil(horizontal / 2),
        top: Math.floor(vertical / 2),
        bottom: Math.ceil(vertical / 2),
        background: "#f5f5f4",
      })
      .webp({ quality: 90 })
      .toFile(fileURLToPath(new URL("prepared/" + im.file, root)));
    console.log(im.file);
  }
}
