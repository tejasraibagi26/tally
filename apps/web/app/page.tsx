import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { LogoMark } from "@/components/Logo";
import { FeatureShowcase } from "@/components/marketing/FeatureShowcase";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { ShieldCheck, Check } from "lucide-react";

const TRUST_POINTS = ["No ads", "No data resale", "Nothing sent to a third-party LLM"] as const;

const STEPS = [
  { n: "01", title: "Connect", body: "Link your checking, credit card, and brokerage accounts through Plaid in minutes." },
  { n: "02", title: "Sync automatically", body: "Webhooks and a nightly safety net keep everything current without you clicking anything." },
  { n: "03", title: "See everything at once", body: "One dashboard for net worth, spend, budgets, and upcoming bills." },
] as const;

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/overview");

  return (
    <div className="min-h-screen bg-canvas overflow-x-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-[0.12]"
          style={{ background: "var(--series-1)", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite" }}
        />
        <div
          className="absolute top-1/3 -right-40 w-[420px] h-[420px] rounded-full opacity-[0.10]"
          style={{ background: "var(--series-7)", filter: "blur(100px)", animation: "drift 22s ease-in-out infinite reverse" }}
        />
      </div>

      <header className="max-w-[1120px] mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-display text-xl text-text">Tally</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm font-medium text-text-2 hover:text-text transition-colors">
            Docs
          </Link>
          <ThemeToggle />
          <Link
            href="/login"
            className="h-9 px-4 inline-flex items-center rounded-control bg-brand text-on-brand text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="max-w-[1120px] mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-6">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-brand">Private · Self-hosted · Plaid-powered</span>
            <h1 className="font-display text-[56px] leading-[1.05] text-text">
              Every account.
              <br />
              One ledger.
              <br />
              Zero guesswork.
            </h1>
            <p className="text-[17px] text-text-2 max-w-md leading-relaxed">
              Tally connects your banks, cards, and brokerages, categorizes everything automatically, and shows you
              exactly where you stand, without a single spreadsheet.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/login"
                className="h-11 px-5 inline-flex items-center rounded-control bg-brand text-on-brand text-[15px] font-medium hover:bg-brand-hover transition-colors"
              >
                Sign in →
              </Link>
              <span className="text-sm text-text-3">
                No account? This instance is invite-only, but you can{" "}
                <Link href="/docs" className="text-text-2 hover:text-brand underline underline-offset-2">
                  self-host your own
                </Link>
                .
              </span>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className="max-w-[1120px] mx-auto px-6 py-20">
          <ScrollReveal className="flex flex-col items-center gap-2 mb-10 text-center">
            <h2 className="font-display text-3xl text-text">Everything a spreadsheet promised and never delivered</h2>
            <p className="text-text-2 max-w-lg">Click through, or just watch it cycle.</p>
          </ScrollReveal>
          <ScrollReveal>
            <FeatureShowcase />
          </ScrollReveal>
        </section>

        <section className="max-w-[1120px] mx-auto px-6 py-20">
          <ScrollReveal className="text-center mb-14">
            <h2 className="font-display text-3xl text-text">From bank login to full picture in minutes</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <ScrollReveal key={s.n} delay={i * 120} className="flex flex-col gap-2">
                <span className="font-display text-4xl text-brand">{s.n}</span>
                <span className="text-[17px] font-semibold text-text">{s.title}</span>
                <span className="text-[14.5px] text-text-2 leading-relaxed">{s.body}</span>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="max-w-[1120px] mx-auto px-6 pb-24">
          <ScrollReveal>
            <div className="relative overflow-hidden bg-surface border border-border rounded-panel p-10 flex flex-col items-center gap-5 text-center">
              <div
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full opacity-[0.16] pointer-events-none"
                style={{ background: "var(--brand)", filter: "blur(80px)" }}
                aria-hidden
              />

              <div className="relative w-14 h-14 rounded-full bg-brand-subtle flex items-center justify-center">
                <ShieldCheck size={26} strokeWidth={1.75} className="text-brand" />
              </div>

              <span className="relative font-display text-3xl text-text">Your money, your server, your rules.</span>

              <div className="relative flex items-center gap-x-6 gap-y-2 flex-wrap justify-center">
                {TRUST_POINTS.map((point) => (
                  <span key={point} className="inline-flex items-center gap-1.5 text-[14.5px] text-text-2">
                    <Check size={15} strokeWidth={2} className="text-positive flex-none" />
                    {point}
                  </span>
                ))}
              </div>

              <Link
                href="/docs"
                className="relative h-11 px-6 inline-flex items-center rounded-control bg-brand text-on-brand text-[15px] font-medium hover:bg-brand-hover transition-colors"
              >
                Read the self-hosting guide →
              </Link>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="max-w-[1120px] mx-auto px-6 py-8 flex items-center justify-between text-xs text-text-3 flex-wrap gap-2">
        <span>Tally · self-hosted personal finance</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-text-2 transition-colors">
            Privacy
          </Link>
          <span>Built on Plaid · Next.js · Postgres</span>
        </div>
      </footer>
    </div>
  );
}
