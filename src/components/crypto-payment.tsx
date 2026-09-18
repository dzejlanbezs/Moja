"use client";

import Image from "next/image";
import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";

import type { CryptoAsset } from "@/lib/crypto-wallets";
import { formatPrice } from "@/lib/format";

export type CryptoAssetWithQr = CryptoAsset & { qr: string };

export function CryptoPayment({
  assets,
  selected,
  onSelect,
  amountCents,
  feeCents,
  minCents,
}: {
  assets: CryptoAssetWithQr[];
  selected: CryptoAssetWithQr;
  onSelect: (asset: CryptoAssetWithQr) => void;
  amountCents: number;
  feeCents: number;
  minCents: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(selected.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-red-500/70 bg-red-500/10 p-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-red-300 uppercase">
          <AlertTriangle className="h-3.5 w-3.5" /> Note
        </p>
        <p className="mt-2 text-sm leading-relaxed text-red-100">
          Send any amount over {formatPrice(minCents)} to the address below and it will be credited to your
          balance automatically with a <span className="font-semibold">0.5% fee</span>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {assets.map((asset) => {
          const active = asset.id === selected.id;
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => onSelect(asset)}
              style={active ? { borderColor: `${asset.accent}99`, background: `${asset.accent}22` } : undefined}
              className={`btn !px-4 !py-2.5 border ${
                active ? "text-white" : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
              }`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: asset.accent }}
              >
                {asset.symbol.slice(0, 1)}
              </span>
              {asset.symbol}
            </button>
          );
        })}
      </div>

      <div className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="mx-auto shrink-0 rounded-2xl bg-white p-2.5">
          <Image
            src={selected.qr}
            alt={`${selected.name} deposit address QR code`}
            width={168}
            height={168}
            unoptimized
            className="h-42 w-42 rounded-lg"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-mist-100">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: selected.accent }}
            >
              {selected.symbol.slice(0, 1)}
            </span>
            {selected.name}
          </p>
          <p className="mt-1 text-xs text-mist-500">{selected.network}</p>

          <p className="mt-4 text-[11px] tracking-[0.14em] text-mist-500 uppercase">Deposit address</p>
          <p className="mt-1.5 font-mono text-[13px] leading-relaxed break-all text-mist-100">
            {selected.address}
          </p>

          <button type="button" onClick={copyAddress} className="btn-soft mt-3 !px-4 !py-2 text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Address copied" : "Copy address"}
          </button>
        </div>
      </div>

      <div className="space-y-2.5 rounded-2xl border border-white/8 bg-white/3 p-5 text-sm">
        <div className="flex justify-between text-mist-300">
          <span>You send</span>
          <span>{formatPrice(amountCents)} in {selected.symbol}</span>
        </div>
        <div className="flex justify-between text-mist-300">
          <span>Processing fee (0.5%)</span>
          <span>−{formatPrice(feeCents)}</span>
        </div>
        <div className="flex justify-between border-t border-white/8 pt-2.5 font-medium">
          <span>Credited to your balance</span>
          <span className="text-emerald-300">{formatPrice(amountCents - feeCents)}</span>
        </div>
      </div>
    </div>
  );
}
