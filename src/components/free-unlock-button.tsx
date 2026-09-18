"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

/** Free profiles skip checkout and admin approval — one click opens the chat. */
export function FreeUnlockButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, method: "card" }),
      });
      const data = (await response.json()) as { error?: string; conversationId?: number };
      if (!response.ok || !data.conversationId) {
        setError(data.error ?? "Could not open the chat");
        return;
      }
      router.push(`/chat/${data.conversationId}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button onClick={unlock} disabled={busy} className="btn-primary !px-9 !py-4 text-base">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
        Talk to Her!
      </button>
      <p className="mt-2 text-xs text-emerald-300">
        {busy
          ? `Opening your chat with ${name.split(" ")[0]}…`
          : "Opens instantly — no payment, no account needed"}
      </p>
      {error && <p className="mt-2 text-xs text-blush-400">{error}</p>}
    </div>
  );
}
