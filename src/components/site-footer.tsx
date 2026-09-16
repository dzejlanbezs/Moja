import { PrefetchLink } from "@/components/prefetch-link";

import { Logo } from "@/components/logo";
import { brandAssets } from "@/lib/brand";

export function SiteFooter() {
  const { logoUrl } = brandAssets();
  return (
    <footer className="mt-24 border-t border-white/8 px-5 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo logoUrl={logoUrl} />
          <p className="mt-4 text-sm leading-relaxed text-mist-500">
            Aurea is a curated catalog of companions for private, one-to-one conversation. Every profile is
            verified, every chat is unlocked manually by our team.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-[0.14em] text-mist-500 uppercase">Browse</p>
            <PrefetchLink href="/" className="block text-mist-300 hover:text-white">
              Catalog
            </PrefetchLink>
            <PrefetchLink href="/#how" className="block text-mist-300 hover:text-white">
              How it works
            </PrefetchLink>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-[0.14em] text-mist-500 uppercase">Account</p>
            <PrefetchLink href="/login" className="block text-mist-300 hover:text-white">
              Member sign in
            </PrefetchLink>
            <PrefetchLink href="/register" className="block text-mist-300 hover:text-white">
              Create account
            </PrefetchLink>
            <PrefetchLink href="/chat" className="block text-mist-300 hover:text-white">
              My chats
            </PrefetchLink>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-[0.14em] text-mist-500 uppercase">Staff</p>
            <PrefetchLink href="/portal/login" className="block text-mist-300 hover:text-white">
              Talent portal
            </PrefetchLink>
            <PrefetchLink href="/admin/login" className="block text-mist-300 hover:text-white">
              Admin panel
            </PrefetchLink>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/8 pt-6 text-xs text-mist-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Aurea. All rights reserved.</p>
        <p>18+ only. Be kind to each other.</p>
      </div>
    </footer>
  );
}
