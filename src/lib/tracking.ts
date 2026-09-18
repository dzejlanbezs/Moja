import "server-only";

/**
 * TrafficJunky conversion tracking. The pixel is fired once per conversation,
 * the first time the member opens that chat, so one ad click counts once.
 *
 * Overridable with TRAFFICJUNKY_AD_ID, TRAFFICJUNKY_MEMBER_ID and
 * TRAFFICJUNKY_VALUE. Clear TRAFFICJUNKY_AD_ID to switch tracking off.
 */
const AD_ID = process.env.TRAFFICJUNKY_AD_ID ?? "1000588121";
const MEMBER_ID = process.env.TRAFFICJUNKY_MEMBER_ID ?? "1009196331";
const VALUE = process.env.TRAFFICJUNKY_VALUE ?? "0.50";

export const trackingEnabled = () => AD_ID.length > 0 && MEMBER_ID.length > 0;

/** The Client Hints delegation TrafficJunky asks for in the <head>. */
export const DELEGATE_CH =
  "sec-ch-ua https://ads.trafficjunky.net; sec-ch-ua-arch https://ads.trafficjunky.net; " +
  "sec-ch-ua-full-version-list https://ads.trafficjunky.net; sec-ch-ua-mobile https://ads.trafficjunky.net; " +
  "sec-ch-ua-model https://ads.trafficjunky.net; sec-ch-ua-platform https://ads.trafficjunky.net; " +
  "sec-ch-ua-platform-version https://ads.trafficjunky.net;";

export function conversionPixelUrl(input: { transactionId: string; description: string }) {
  const params = new URLSearchParams({
    a: AD_ID,
    member_id: MEMBER_ID,
    // Cache buster, so every call reaches the tracker.
    cb: `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`,
    cti: input.transactionId,
    ctv: VALUE,
    ctd: input.description,
  });
  return `https://ads.trafficjunky.net/ct?${params.toString()}`;
}
