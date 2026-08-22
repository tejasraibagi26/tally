"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      aria-label="Sign out"
      title="Sign out"
      className="w-7 h-7 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-negative hover:bg-negative-subtle transition-colors"
    >
      <LogOut size={15} strokeWidth={2} />
    </button>
  );
}
