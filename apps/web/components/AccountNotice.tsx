import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoMark } from "@/components/Logo";

/**
 * The page behind a link in an account email (confirming a new sign-in
 * email, unsubscribing): the login page's shell -- logo, theme switch, one
 * centred card -- so it reads as Tally in either look, signed in or not.
 * `children` is the action, usually a plain <form method="post"> so it
 * works before (or without) hydration.
 */
export function AccountNotice({ title, children, footer }: { title: string; children?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="max-w-[1120px] w-full mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-display text-xl text-text">Tally</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm bg-surface border border-border rounded-panel shadow-raised p-8 flex flex-col gap-5 text-center">
          <div className="flex justify-center" style={{ animation: "empty-pop 450ms ease-out" }}>
            <LogoMark size={40} />
          </div>
          <h1 className="ui-page-title m-0 font-display text-2xl text-text">{title}</h1>
          {children}
        </div>
      </main>
      {footer && <p className="pb-8 px-6 text-center text-xs text-text-3">{footer}</p>}
    </div>
  );
}

/** Body copy inside an AccountNotice card. */
export function NoticeText({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[15px] leading-relaxed text-text-2">{children}</p>;
}
