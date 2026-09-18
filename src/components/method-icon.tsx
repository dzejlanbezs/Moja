"use client";

import Image from "next/image";
import { Bitcoin, CreditCard, Wallet } from "lucide-react";

export type MethodKey = "card" | "paypal" | "cashapp" | "crypto" | "balance";
export type ProviderLogos = Partial<Record<string, string | null>>;

const FALLBACK = {
  card: CreditCard,
  paypal: Wallet,
  cashapp: Wallet,
  crypto: Bitcoin,
  balance: Wallet,
} as const;

/** Uses the logo dropped into public/providers/<key>.png when there is one, otherwise a built-in icon. */
export function MethodIcon({
  method,
  logos,
  size = 16,
  className = "",
}: {
  method: MethodKey;
  logos?: ProviderLogos;
  size?: number;
  className?: string;
}) {
  const logo = logos?.[method];
  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size }}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }

  const Icon = FALLBACK[method];
  return <Icon style={{ width: size, height: size }} className={`shrink-0 ${className}`} />;
}
