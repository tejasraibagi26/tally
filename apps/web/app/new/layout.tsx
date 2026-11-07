import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewMark, NewNav } from "@/components/new/NewNav";
import { Toaster } from "@/components/ui/Toaster";
import "./new.css";

export const metadata: Metadata = { title: "Tally (new)" };

/**
 * The new Tally pilot: its own shell, outside the classic app's sidebar.
 * Everything under /new reads the same data as the classic pages; anything
 * it can't edit yet links back to the classic page that can.
 */
export default async function NewLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const initial = (session.user.name ?? session.user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="tn">
      <header className="tn-header">
        <Link href="/new" className="tn-brand">
          <NewMark />
          tally
          <span className="tn-pill-tag">Preview</span>
        </Link>
        <NewNav />
        <Link href="/overview" className="tn-classic">
          Classic view
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: "#2a2a24", color: "#f2f1ea", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {initial}
        </Link>
      </header>
      {children}
      <Toaster />
    </div>
  );
}
