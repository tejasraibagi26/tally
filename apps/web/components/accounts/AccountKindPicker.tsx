"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { accountKindLabel, kindOptions } from "@tally/core/accountKind";
import { cn } from "@/lib/cn";

// The "Checking" / "Savings" caption under an account's name, made pickable
// for bank accounts: Plaid's own tag is the default ("from bank"), and the
// user can retag it -- a second checking account kept as savings. Other
// types just show their label. See @tally/core/accountKind.
export function AccountKindPicker({
  accountId,
  type,
  plaidSubtype,
  subtypeOverride,
  className,
}: {
  accountId: string;
  type: string;
  plaidSubtype: string | null;
  subtypeOverride: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(subtypeOverride ?? "");
  const [saving, setSaving] = useState(false);
  const kinds = kindOptions(type);
  const bankLabel = !plaidSubtype && type === "depository" ? "Bank account" : accountKindLabel(type, plaidSubtype);

  if (kinds.length === 0) return <span className={className}>{bankLabel}</span>;

  async function save(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtypeOverride: next || null }),
      });
      if (!res.ok) throw new Error("Failed to update account kind");
      router.refresh();
    } catch (err) {
      console.error(err);
      setValue(previous);
    } finally {
      setSaving(false);
    }
  }

  const shown = value ? accountKindLabel(type, value) : bankLabel;
  return (
    <span className={cn("relative inline-flex items-center gap-0.5 hover:text-text-2", saving && "opacity-60", className)}>
      {shown}
      <ChevronDown size={11} className="flex-none" />
      {/* The native select sits invisibly over the label: the platform menu
          on every browser, keyboard and screen readers for free. */}
      <select
        aria-label="Kind of account"
        title="What kind of account this is. Savings don't count toward Safe to spend."
        value={value}
        disabled={saving}
        onChange={(e) => void save(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="">{bankLabel} (from bank)</option>
        {kinds
          .filter((k) => k !== (plaidSubtype ?? "").toLowerCase())
          .map((k) => (
            <option key={k} value={k}>
              {accountKindLabel(type, k)}
            </option>
          ))}
      </select>
    </span>
  );
}
