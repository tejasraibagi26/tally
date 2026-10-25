import { Suspense } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoMark } from "@/components/Logo";
import { LoginForm } from "@/components/login/LoginForm";
import { DEMO_MODE } from "@/lib/demo";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col overflow-hidden">
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

      <header className="max-w-[1120px] w-full mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-display text-xl text-text">Tally</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <Suspense fallback={null}>
          <LoginForm demoMode={DEMO_MODE} />
        </Suspense>
      </div>
    </div>
  );
}
