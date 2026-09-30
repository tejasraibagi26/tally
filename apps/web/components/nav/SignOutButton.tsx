"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      aria-label="Sign out"
      title="Sign out"
      className="w-8 h-8 flex-none rounded-control flex items-center justify-center text-negative hover:bg-negative-subtle transition-colors"
    >
      <LogOut size={16} strokeWidth={1.75} />
    </button>
  );
}
