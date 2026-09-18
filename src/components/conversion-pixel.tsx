import { conversionPixelUrl } from "@/lib/tracking";

/**
 * 1x1 TrafficJunky conversion pixel. Rendered only on the request that first
 * opens a chat, never on later visits, so conversions are not double counted.
 */
export function ConversionPixel({
  transactionId,
  description,
}: {
  transactionId: string;
  description: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tracking pixel must be a plain img
    <img
      id={`${process.env.TRAFFICJUNKY_AD_ID ?? "1000588121"}_cpa_testing`}
      src={conversionPixelUrl({ transactionId, description })}
      width={1}
      height={1}
      alt=""
      style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
    />
  );
}
