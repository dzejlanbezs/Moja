import { formatPrice } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/paygate";
import { pushover } from "@/lib/pushover";
import { OrderError, markPaymentReceived } from "@/lib/queries";

/**
 * PayGate calls this with a GET when the customer finishes paying, echoing back
 * our own query parameters plus value_coin (the USDC that was actually sent).
 * The payment still waits for the admin to approve it in the panel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");
  const token = url.searchParams.get("t");
  const valueCoin = url.searchParams.get("value_coin");

  if (!ref || !token) return new Response("missing reference", { status: 400 });

  try {
    const result = markPaymentReceived(ref, token, valueCoin);
    const provider = PROVIDER_LABEL[result.view.provider ?? ""] ?? result.view.provider ?? "hosted checkout";

    if (result.kind === "order") {
      pushover({
        title: `${result.view.modelName.split(" ")[0]} — payment received`,
        message: `${result.view.userName} paid ${formatPrice(result.view.amountCents)} via ${provider} · ${result.view.code} — approve it in the admin panel.`,
      });
    } else {
      pushover({
        title: `Top-up paid · ${formatPrice(result.view.amountCents)}`,
        message: `${result.view.userName} paid via ${provider} · ${result.view.code} — approve it to credit the balance.`,
      });
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    if (error instanceof OrderError) return new Response(error.message, { status: 404 });
    throw error;
  }
}
