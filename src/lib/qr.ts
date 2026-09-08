import "server-only";

import QRCode from "qrcode";

import { CRYPTO_ASSETS } from "@/lib/crypto-wallets";

const cache = new Map<string, string>();

/** QR payload is the bare wallet address, so any wallet app reads it as a plain address. */
export async function addressQrDataUrl(address: string) {
  const cached = cache.get(address);
  if (cached) return cached;

  const dataUrl = await QRCode.toDataURL(address, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: { dark: "#05040a", light: "#ffffff" },
  });
  cache.set(address, dataUrl);
  return dataUrl;
}

export async function cryptoAssetsWithQr() {
  return Promise.all(
    CRYPTO_ASSETS.map(async (asset) => ({ ...asset, qr: await addressQrDataUrl(asset.address) })),
  );
}
