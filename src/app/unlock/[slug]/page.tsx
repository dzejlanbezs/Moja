import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PaymentPanel } from "@/components/payment-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { getAccess, getModelBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Checkout" };

export default async function UnlockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = getModelBySlug(slug);
  if (!model) notFound();

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/unlock/${slug}`);
  if (user.role !== "user") redirect("/");

  const access = getAccess(user.id, model.id);
  if (access.status === "unlocked") redirect(`/chat/${access.conversationId}`);
  if (access.status === "pending") redirect("/account");
  // Free profiles have no checkout at all; the one-click CTA lives on her profile.
  if (model.priceCents === 0) redirect(`/model/${model.slug}`);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20">
        <Link
          href={`/model/${model.slug}`}
          className="inline-flex items-center gap-2 text-sm text-mist-500 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {model.name.split(" ")[0]}
        </Link>

        <div className="mt-6 mb-10 animate-rise">
          <span className="chip">Step 2 of 3 · payment</span>
          <h1 className="mt-5 font-display text-5xl leading-none sm:text-6xl">
            Unlock <span className="text-gradient">{model.name.split(" ")[0]}</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-mist-300">
            Pay with a card or from your balance. Our team approves the payment and the chat lands in your inbox.
          </p>
        </div>

        <PaymentPanel
          model={{
            slug: model.slug,
            name: model.name,
            cover: model.cover,
            priceCents: model.priceCents,
            city: model.city,
            age: model.age,
          }}
          balanceCents={user.balanceCents}
        />
      </main>

      <SiteFooter />
    </>
  );
}
