import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/nav/SignOutButton";
import { MOCK_MODE } from "@/lib/config";

export function TopBar({ userEmail }: { userEmail: string }) {
  return (
    <header className="h-16 flex-none border-b border-border bg-surface flex items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-3 font-mono">{userEmail}</span>
        {MOCK_MODE && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-subtle text-warning text-xs font-medium px-2.5 py-0.5">
            Mock data
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
