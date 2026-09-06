import "server-only";

import { formatPrice } from "@/lib/format";

/**
 * Sends a Pushover notification. Fire and forget: it never blocks the request that
 * triggered it, and a failed notification never breaks a payment or a chat.
 *
 * Set PUSHOVER_TOKEN and PUSHOVER_USER to switch notifications on; without them
 * every call here is a no-op. SITE_URL is optional and turns the notification into
 * a link straight to the admin panel.
 */
export function pushover({ title, message }: { title: string; message: string }) {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) return;

  const params = new URLSearchParams({ token, user, title, message });
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "");
  if (siteUrl) {
    params.set("url", `${siteUrl}/admin`);
    params.set("url_title", "Open the admin panel");
  }

  fetch("https://api.pushover.net/1/messages.json", { method: "POST", body: params }).catch((error) => {
    console.error("Pushover notification failed:", error);
  });
}

/* ---------------------------- the events we announce --------------------------- */

export function notifyChatUnlocked(input: {
  modelName: string;
  memberName: string;
  amountCents: number;
  method: string;
  code: string;
  free: boolean;
}) {
  pushover({
    title: `${input.modelName.split(" ")[0]} needs to talk`,
    message: input.free
      ? `${input.memberName} opened her free chat.`
      : `${input.memberName} paid ${formatPrice(input.amountCents)} by ${input.method} · ${input.code} — approve it in the admin panel.`,
  });
}

export function notifyTopup(input: {
  memberName: string;
  amountCents: number;
  creditCents: number;
  code: string;
  /** Coin symbol for crypto, card brand and last four for a card. */
  source: string;
}) {
  const fee = input.amountCents - input.creditCents;
  pushover({
    title: `Top-up · ${formatPrice(input.amountCents)}`,
    message:
      fee > 0
        ? `${input.memberName} sent ${formatPrice(input.amountCents)} via ${input.source} · ${input.code} — ${formatPrice(input.creditCents)} after the fee.`
        : `${input.memberName} paid ${formatPrice(input.amountCents)} with ${input.source} · ${input.code} — approve it to credit the balance.`,
  });
}

export function notifyGift(input: {
  modelName: string;
  memberName: string;
  amountCents: number;
  note?: string | null;
}) {
  pushover({
    title: `${input.modelName.split(" ")[0]} got a gift`,
    message: `${input.memberName} sent ${formatPrice(input.amountCents)}${input.note ? ` — “${input.note}”` : ""}`,
  });
}

export function notifyTipPaid(input: { modelName: string; memberName: string; amountCents: number }) {
  pushover({
    title: `${input.modelName.split(" ")[0]} got a tip`,
    message: `${input.memberName} paid her ${formatPrice(input.amountCents)} request.`,
  });
}

export function notifyNewMember(input: { name: string; email: string; fromGuest: boolean }) {
  pushover({
    title: "New member",
    message: input.fromGuest
      ? `${input.name} (${input.email}) registered from a guest chat.`
      : `${input.name} (${input.email}) just signed up.`,
  });
}
