import "server-only";

import crypto from "node:crypto";

export { PROVIDER_LABEL } from "@/lib/providers";

/**
 * PayGate.to — the customer pays with a card (Banxa) or PayPal, and the payout
 * lands on our USDC (Polygon) wallet. Two steps: ask for a temporary receiving
 * address, then redirect the customer to the checkout link built from it.
 *
 * Overridable with PAYGATE_ADDRESS, PAYGATE_EMAIL and SITE_URL.
 */
const PAYOUT_ADDRESS = process.env.PAYGATE_ADDRESS || "0x020c6b1c7adc49e629a1fcb2133a714ad29ce1a2";
const CONTACT_EMAIL = process.env.PAYGATE_EMAIL || "infektorr234@gmail.com";
const SITE_URL = (process.env.SITE_URL || "https://www.theaurea.app").replace(/\/+$/, "");

export type PaygateMethod = "card" | "paypal";

const PROVIDER_ID: Record<PaygateMethod, string> = { card: "banxa", paypal: "paypal" };

export class PaygateError extends Error {}

export function newPaymentToken() {
  return crypto.randomBytes(16).toString("hex");
}

export function providerIdFor(method: PaygateMethod) {
  return PROVIDER_ID[method];
}

function callbackUrl(ref: string, token: string) {
  return `${SITE_URL}/api/paygate/callback?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`;
}

/**
 * Creates the temporary receiving wallet and returns the link the customer must
 * be redirected to. The link has to open in the top window — PayGate does not
 * allow the provider page inside an iframe.
 */
export async function createPaygatePayment(input: {
  ref: string;
  token: string;
  amountCents: number;
  method: PaygateMethod;
}) {
  const wallet = new URL("https://api.paygate.to/control/wallet.php");
  wallet.searchParams.set("address", PAYOUT_ADDRESS);
  wallet.searchParams.set("callback", callbackUrl(input.ref, input.token));

  let response: Response;
  try {
    response = await fetch(wallet, { cache: "no-store" });
  } catch {
    throw new PaygateError("Could not reach the payment provider, please try again");
  }
  if (!response.ok) throw new PaygateError("The payment provider rejected the request");

  const data = (await response.json().catch(() => null)) as
    | { address_in?: string; polygon_address_in?: string; ipn_token?: string }
    | null;
  if (!data?.address_in) throw new PaygateError("The payment provider did not return an address");

  // address_in arrives already percent-encoded, so it is appended as-is.
  const amount = (input.amountCents / 100).toFixed(2);
  const payUrl =
    "https://checkout.paygate.to/process-payment.php" +
    `?address=${data.address_in}` +
    `&amount=${amount}` +
    `&provider=${PROVIDER_ID[input.method]}` +
    `&email=${encodeURIComponent(CONTACT_EMAIL)}` +
    "&currency=USD";

  return {
    payUrl,
    providerId: PROVIDER_ID[input.method],
    polygonAddress: data.polygon_address_in ?? null,
    ipnToken: data.ipn_token ?? null,
  };
}
