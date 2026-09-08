import Image from "next/image";
import Link from "next/link";

export function Logo({
  href = "/",
  label = "Aurea",
  logoUrl = null,
}: {
  href?: string;
  label?: string;
  logoUrl?: string | null;
}) {
  if (logoUrl) {
    return (
      <Link href={href} className="flex items-center">
        <Image
          src={logoUrl}
          alt={label}
          width={220}
          height={56}
          priority
          unoptimized
          className="h-10 w-auto object-contain"
        />
      </Link>
    );
  }

  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-500 to-violet-500 shadow-[0_8px_24px_-8px_rgba(255,61,127,0.9)]">
        <span className="font-display text-lg leading-none text-white">a</span>
        <span className="absolute -inset-1 rounded-3xl bg-blush-500/25 opacity-0 blur transition group-hover:opacity-100" />
      </span>
      <span className="text-[15px] font-semibold tracking-[0.22em] text-mist-100 uppercase">{label}</span>
    </Link>
  );
}
