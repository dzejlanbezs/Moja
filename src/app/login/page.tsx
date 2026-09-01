import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser, homeForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  if (user) redirect(next || homeForRole(user.role));

  return (
    <AuthShell
      eyebrow="Member sign in"
      title={
        <>
          Welcome <span className="text-gradient">back</span>
        </>
      }
      subtitle="Sign in to unlock profiles and open your private chats."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="text-blush-400 hover:text-blush-500">
            Create one free
          </Link>
        </>
      }
      hint={{ label: "Demo member", lines: ["demo@aurea.chat", "demo1234"] }}
    >
      <AuthForm mode="login" portal="member" next={next} submitLabel="Sign in" />
    </AuthShell>
  );
}
