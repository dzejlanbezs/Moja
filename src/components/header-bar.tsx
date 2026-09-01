"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, MessageCircle, Wallet, X } from "lucide-react";

import { Logo } from "@/components/logo";
import { formatPrice, initials } from "@/lib/format";
import type { SessionUser } from "@/lib/types";

type NavItem = { href: string; label: string; badge?: number };

export function HeaderBar({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(0);
  const [balance, setBalance] = useState(user?.balanceCents ?? 0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unread: number; pending: number; balanceCents: number };
        if (!alive) return;
        setUnread(data.unread);
        setPending(data.pending);
        if (user.role === "user") setBalance(data.balanceCents);
      } catch {
        /* offline polling is best-effort */
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  const items: NavItem[] = [{ href: "/", label: "Catalog" }];
  if (!user || user.role === "user") items.push({ href: "/#how", label: "How it works" });
  if (user?.role === "user") {
    items.push({ href: "/chat", label: "Chat", badge: unread });
    items.push({ href: "/account", label: "Account" });
  }
  if (user?.role === "model") items.push({ href: "/portal", label: "Inbox", badge: unread });
  if (user?.role === "admin") items.push({ href: "/admin", label: "Payments", badge: pending });

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="glass-strong mx-auto flex max-w-7xl items-center gap-3 rounded-[26px] px-4 py-3 sm:px-6">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-full px-4 py-2 text-sm transition ${
                pathname === item.href ? "bg-white/10 text-white" : "text-mist-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
              {!!item.badge && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-500 px-1.5 text-[11px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user?.role === "user" && (
            <Link
              href="/account"
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-mist-100 transition hover:bg-white/10 sm:flex"
            >
              <Wallet className="h-4 w-4 text-blush-400" />
              {formatPrice(balance)}
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pr-4 pl-1.5 sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blush-500 to-violet-500 text-xs font-semibold text-white">
                  {initials(user.displayName)}
                </span>
                <span className="text-sm text-mist-100">{user.displayName.split(" ")[0]}</span>
              </div>
              <button
                onClick={signOut}
                title="Sign out"
                className="btn-ghost h-10 w-10 !px-0"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Join free
              </Link>
            </div>
          )}

          <button
            className="btn-ghost h-10 w-10 !px-0 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass-strong mx-auto mt-2 max-w-7xl animate-pop rounded-[26px] p-3 md:hidden">
          <div className="flex flex-col">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] text-mist-100 hover:bg-white/6"
              >
                {item.label}
                {!!item.badge && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-500 px-1.5 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            {user?.role === "user" && (
              <div className="mt-1 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-mist-300">
                  <Wallet className="h-4 w-4 text-blush-400" /> Balance
                </span>
                <span className="font-medium">{formatPrice(balance)}</span>
              </div>
            )}
            {!user && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" className="btn-ghost">
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary">
                  Join free
                </Link>
              </div>
            )}
            {user?.role === "user" && (
              <Link href="/chat" className="btn-primary mt-2">
                <MessageCircle className="h-4 w-4" /> Open chat
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
