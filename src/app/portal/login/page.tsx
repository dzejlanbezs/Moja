import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Talent sign in" };

export default async function PortalLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "model") redirect("/portal");

  return (
    <AuthShell
      eyebrow="Talent portal"
      title={
        <>
          Your <span className="text-gradient">inbox</span>
        </>
      }
      subtitle="Sign in to answer the members who unlocked a chat with you."
      hint={{ label: "Demo talent", lines: ["sofia@aurea.chat", "model1234"] }}
    >
      <AuthForm mode="login" portal="model" next="/portal" submitLabel="Open my inbox" />
    </AuthShell>
  );
}
