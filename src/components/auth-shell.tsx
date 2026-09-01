import Link from "next/link";

import { Logo } from "@/components/logo";

type Props = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hint?: { label: string; lines: string[] };
};

export function AuthShell({ eyebrow, title, subtitle, children, footer, hint }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="glass-strong mt-8 rounded-[30px] p-8 sm:p-9">
          <span className="chip">{eyebrow}</span>
          <h1 className="mt-5 font-display text-4xl leading-tight">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-mist-500">{subtitle}</p>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-mist-500">{footer}</div>}
        </div>

        {hint && (
          <div className="card mt-5 p-5">
            <p className="text-[11px] tracking-[0.14em] text-mist-500 uppercase">{hint.label}</p>
            <div className="mt-2 space-y-1 font-mono text-[13px] text-mist-300">
              {hint.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-mist-500">
          <Link href="/" className="hover:text-white">
            ← Back to the catalog
          </Link>
        </p>
      </div>
    </main>
  );
}
