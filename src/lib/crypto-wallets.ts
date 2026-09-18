export type CryptoAsset = {
  id: string;
  name: string;
  symbol: string;
  network: string;
  address: string;
  accent: string;
};

const ERC20_ADDRESS = "0x020c6b1c7adc49e629a1fcb2133a714ad29ce1a2";

export const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    network: "Ethereum network",
    address: ERC20_ADDRESS,
    accent: "#8a92f5",
  },
  {
    id: "usdc",
    name: "USD Coin",
    symbol: "USDC",
    network: "Ethereum · ERC-20",
    address: ERC20_ADDRESS,
    accent: "#3b8df5",
  },
  {
    id: "usdt",
    name: "Tether",
    symbol: "USDT",
    network: "Ethereum · ERC-20",
    address: ERC20_ADDRESS,
    accent: "#26a17b",
  },
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin network",
    address: "bc1qpr3tuz88ukfpx6v6r8v4phy639xf9758s696ql",
    accent: "#f7931a",
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    network: "Solana network",
    address: "EoQfM72bh971hTMf18qQQLNZ1Z4ZRyRYruDTGWr2EPEF",
    accent: "#9945ff",
  },
];

export function findCryptoAsset(id: string | undefined | null) {
  return CRYPTO_ASSETS.find((asset) => asset.id === id);
}

/** Crypto top-ups are credited minus a 0.5% processing fee. */
export const CRYPTO_FEE_BPS = 50;

export function cryptoFeeCents(amountCents: number) {
  return Math.round((amountCents * CRYPTO_FEE_BPS) / 10_000);
}
