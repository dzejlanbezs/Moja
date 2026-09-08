import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TopupPanel } from "@/components/topup-panel";
import { getSessionUser } from "@/lib/auth";
import { cryptoAssetsWithQr } from "@/lib/qr";
import { MIN_TOPUP_CENTS } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Top up balance" };

export default async function TopupPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/topup");
  if (user.role !== "user") redirect("/");

  const assets = await cryptoAssetsWithQr();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20">
        <Link href="/account" className="inline-flex items-center gap-2 text-sm text-mist-500 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to my account
        </Link>

        <div className="mt-6 mb-10 animate-rise">
          <span className="chip">Wallet</span>
          <h1 className="mt-5 font-display text-5xl leading-none sm:text-6xl">
            Top up your <span className="text-gradient">balance</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-mist-300">
            Choose an amount, confirm it, then pay by card or with crypto. The money is added to your wallet as
            soon as the payment is confirmed.
          </p>
        </div>

        <TopupPanel balanceCents={user.balanceCents} minCents={MIN_TOPUP_CENTS} assets={assets} />
      </main>

      <SiteFooter />
    </>
  );
}
