import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link
      aria-label="Lowkey Saints, inicio"
      className="group inline-flex h-16 w-32 items-center justify-center overflow-hidden"
      href="/"
    >
      <Image
        alt="Lowkey Saints"
        className="h-full w-full object-contain"
        height={1280}
        priority
        src="/lowkey%20Saints%20Imagen.png"
        width={1280}
      />
    </Link>
  );
}
