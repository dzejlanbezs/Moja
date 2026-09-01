import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser, homeForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  if (user) redirect(next || homeForRole(user.role));

  return (
    <AuthShell
      eyebrow="Free membership"
      title={
        <>
          Join <span className="text-gradient">Aurea</span>
        </>
      }
      subtitle="Browsing is free. You only pay when you want to talk to someone."
      footer={
        <>
          Already a member?{" "}
          <Link href="/login" className="text-blush-400 hover:text-blush-500">
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm mode="register" next={next} submitLabel="Create my account" />
    </AuthShell>
  );
}
