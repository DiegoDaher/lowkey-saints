import Image, { type ImageProps } from "next/image";
import imageOriginals from "@/data/catalog-image-originals.json";
import imageFrames from "@/data/catalog-image-frames.json";

type ProductImageProps = Omit<ImageProps, "src" | "fill"> & { src: string };

// Use in a relative 4:5 frame, including thumbnails, so the padding masks
// remain aligned with the imported photos at every size.
export default function ProductImage({
  src,
  alt,
  className = "",
  style,
  ...props
}: ProductImageProps) {
  const filename = src.split("?")[0].split("/").pop() ?? "";
  const original = (imageOriginals as Record<string, string>)[filename];
  const clipPath = (imageFrames as Record<string, string>)[filename];

  return (
    <Image
      {...props}
      fill
      unoptimized
      alt={alt}
      src={original ?? src}
      className={`object-contain ${className}`}
      style={{ ...style, clipPath }}
    />
  );
}
