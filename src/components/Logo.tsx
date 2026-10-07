import Link from "next/link";

export default function Logo() {
  return (
    <Link
      aria-label="Lowkey Saints, inicio"
      className="group inline-flex flex-col items-center leading-none"
      href="/"
    >
      <span className="font-display text-[1.35rem] font-bold tracking-[0.2em]">
        LOWKEY
      </span>
      <span className="font-script decoration-gold -mt-0.5 text-[1.15rem] font-normal tracking-normal underline decoration-2 underline-offset-2">
        Saints
      </span>
    </Link>
  );
}
