import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewMark, NewNav } from "@/components/new/NewNav";
import { Toaster } from "@/components/ui/Toaster";
import { ClassicButton, MakeDefaultBanner } from "@/components/new/UiSwitch";
import { prefersNewUi } from "@/lib/newUi";
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
  const userId = (session.user as { id?: string }).id;
  const optedIn = userId ? await prefersNewUi(userId) : false;

  return (
    <div className="tn">
      <header className="tn-header">
        <Link href="/new" className="tn-brand">
          <NewMark />
          tally
          <span className="tn-pill-tag">Preview</span>
        </Link>
        <NewNav />
        {optedIn ? (
          <ClassicButton />
        ) : (
          <Link href="/overview" className="tn-classic">
            Back to classic
          </Link>
        )}
        <Link
          href="/new/settings"
          aria-label="Settings"
          title="Settings"
          style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: "#2a2a24", color: "#f2f1ea", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {initial}
        </Link>
      </header>
      {!optedIn && (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 32px 8px" }}>
          <MakeDefaultBanner />
        </div>
      )}
      {children}
      <Toaster />
    </div>
  );
}
