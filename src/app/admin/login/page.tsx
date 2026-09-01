import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "admin") redirect("/admin");

  return (
    <AuthShell
      eyebrow="Staff only"
      title={
        <>
          Admin <span className="text-gradient">panel</span>
        </>
      }
      subtitle="Approve incoming payments, manage balances and keep an eye on the platform."
      hint={{ label: "Demo admin", lines: ["admin@aurea.chat", "Admin1234!"] }}
    >
      <AuthForm mode="login" portal="admin" next="/admin" submitLabel="Enter admin panel" />
    </AuthShell>
  );
}
