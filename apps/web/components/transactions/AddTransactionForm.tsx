"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormPanel, panelInputClass } from "@/components/ui/FormPanel";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { localToday } from "@/lib/localToday";
import { DEFAULT_CURRENCY } from "@tally/core/fx";

export interface TransactionAccountOption {
  id: string;
  name: string;
  mask: string | null;
}

export interface TransactionCategoryOption {
  id: string;
  name: string;
  colorSlot: number;
  indent: boolean;
  kind?: string;
}

type Kind = "expense" | "income";

const CHIP_COUNT = 5;

/** YYYY-MM-DD of the browser's yesterday (local, never UTC). */
function localYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Digits and one decimal point; at most 7 whole digits and 2 decimals (up to 9,999,999.99). */
function cleanAmount(raw: string): string {
  const t = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole = "", ...rest] = t.split(".");
  const w = whole.slice(0, 7);
  return rest.length ? `${w}.${rest.join("").slice(0, 2)}` : w;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: thisYear ? undefined : "numeric" });
}

function Chip({ selected, onClick, children, accent }: { selected: boolean; onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "h-9 inline-flex items-center gap-2 rounded-full text-sm transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info",
        selected
          ? "px-[13px] border-2 border-[color:var(--ink)] bg-brand-subtle text-text font-semibold"
          : cn("px-3.5 border border-border bg-surface-2 hover:bg-sunken font-medium", accent ? "text-brand font-semibold" : "text-text"),
      )}
    >
      {children}
    </button>
  );
}

/**
 * For a purchase Plaid never saw -- cash, a bank this app isn't linked to,
 * or something the user just wants tracked right away. Hits POST
 * /api/transactions (stamps the row isManual).
 *
 * The "quick chips" layout, same as mobile v2.17.0 (spec:
 * https://claude.ai/artifact/5yBCsdYtpRYBewyW1X5TDa): the amount is the hero
 * and is focused on open; your most-used categories and Today / Yesterday
 * are one click away; the account is NEVER preselected; the submit button
 * says what it will add and stays disabled until amount, description and
 * account are set.
 */
export function AddTransactionForm({ accounts, categories }: { accounts: TransactionAccountOption[]; categories: TransactionCategoryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("expense");
  const [name, setName] = useState("");
  // Never preselected or remembered: the user must choose the account.
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [postedDate, setPostedDate] = useState(localToday());
  const [pickingDate, setPickingDate] = useState(false);
  const [topIds, setTopIds] = useState<Record<Kind, string[] | undefined>>({ expense: undefined, income: undefined });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Most-used categories for this kind, fetched once per kind while the panel is open.
  useEffect(() => {
    if (!open || topIds[kind]) return;
    let cancelled = false;
    fetch(`/api/categories/top?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : { categoryIds: [] }))
      .then((d: { categoryIds?: string[] }) => {
        if (!cancelled) setTopIds((t) => ({ ...t, [kind]: d.categoryIds ?? [] }));
      })
      .catch(() => {
        if (!cancelled) setTopIds((t) => ({ ...t, [kind]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, topIds]);

  // Focus the amount once the panel has opened (it's the first thing to type).
  useEffect(() => {
    if (open) requestAnimationFrame(() => amountRef.current?.focus());
  }, [open]);

  const ofKind = useMemo(() => categories.filter((c) => (c.kind ?? "expense") === kind), [categories, kind]);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Top 5 of this kind, topped up with top-level categories of the kind while
  // there's little history; a pick from "More" joins the row so it stays visible.
  const chips = useMemo(() => {
    const byId = new Map(ofKind.map((c) => [c.id, c]));
    const row: TransactionCategoryOption[] = [];
    for (const id of topIds[kind] ?? []) {
      const c = byId.get(id);
      if (c) row.push(c);
    }
    for (const c of ofKind) {
      if (row.length >= CHIP_COUNT) break;
      if (!c.indent && !row.some((r) => r.id === c.id)) row.push(c);
    }
    const trimmed = row.slice(0, CHIP_COUNT);
    if (selectedCategory && !trimmed.some((c) => c.id === selectedCategory.id)) trimmed.unshift(selectedCategory);
    return trimmed;
  }, [ofKind, topIds, kind, selectedCategory]);

  if (accounts.length === 0) return null;

  const amountCents = Math.round(parseFloat(amountInput) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents > 0;
  const canSubmit = amountValid && name.trim().length > 0 && !!accountId && !!postedDate;
  const formatted = amountValid ? `$${(amountCents / 100).toFixed(2)}` : null;
  const today = localToday();
  const yesterday = localYesterday();
  const customDate = postedDate !== today && postedDate !== yesterday;
  // The number steps down as it grows so a long amount still fits a line.
  const amountSize = amountInput.length <= 6 ? 56 : amountInput.length <= 8 ? 46 : 38;

  function reset() {
    setAccountId("");
    setName("");
    setAmountInput("");
    setCategoryId("");
    setPostedDate(localToday());
    setPickingDate(false);
    setKind("expense");
  }

  function close() {
    setOpen(false);
    setError(null);
    reset();
  }

  function switchKind(next: Kind) {
    if (next === kind) return;
    setKind(next);
    // An expense category makes no sense on income (and vice versa).
    setCategoryId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Choose an account.");
      return;
    }
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, postedDate, name: name.trim(), amount: amountCents, kind, categoryId: categoryId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't add the transaction. Try again.");
        return;
      }
      showToast(`${name.trim()} added`);
      // Usage changed, so the chips may reorder next time.
      setTopIds({ expense: undefined, income: undefined });
      close();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't add the transaction. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const caption = "text-[11px] font-semibold uppercase tracking-[0.06em] text-text-3 px-1";

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add transaction</Button>
      <FormPanel
        open={open}
        onClose={close}
        title="Add transaction"
        description="For cash, or anything from an account Tally isn't linked to."
        onSubmit={submit}
        submitLabel={`Add ${kind}${formatted ? ` · ${formatted}` : ""}`}
        submitting={saving}
        submitDisabled={!canSubmit}
        error={error}
      >
        {/* Kind, then the amount as the hero. */}
        <div className="flex flex-col items-center gap-2.5 pt-1 pb-1">
          <div role="radiogroup" aria-label="Kind" className="inline-flex p-[3px] rounded-full border border-border bg-surface-2">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => switchKind(k)}
                className={cn(
                  "h-8 px-4 rounded-full text-[13.5px] font-semibold transition-colors",
                  kind === k ? (k === "expense" ? "bg-negative-subtle text-negative" : "bg-positive-subtle text-positive") : "text-text-2 hover:text-text",
                )}
              >
                {k === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-center max-w-full cursor-text">
            <span
              className={cn("font-display leading-none", !amountInput ? "text-text-3" : kind === "expense" ? "text-negative" : "text-positive")}
              style={{ fontSize: amountSize * 0.5 }}
            >
              {kind === "expense" ? "−$" : "+$"}
            </span>
            <input
              ref={amountRef}
              inputMode="decimal"
              aria-label="Amount"
              placeholder="0"
              value={amountInput}
              onChange={(e) => setAmountInput(cleanAmount(e.target.value))}
              className="font-display bg-transparent border-0 outline-none text-text placeholder:text-text-3 p-0 leading-none"
              // Sized to its own text (ch of the display face), so it stays centred.
              style={{ fontSize: amountSize, width: `${Math.max(1, (amountInput || "0").length) + 0.4}ch` }}
            />
          </label>
          <span className="font-mono text-[11px] tracking-[0.04em] text-text-3 -mt-1">{DEFAULT_CURRENCY}</span>
        </div>

        <label className="flex flex-col gap-2">
          <span className={caption}>What was it</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tim Hortons" className={cn(panelInputClass, "h-11 text-[15px]")} />
        </label>

        <div className="flex flex-col gap-2">
          <span className={caption}>Category</span>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}>
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: `var(--series-${((c.colorSlot - 1 + 8) % 8) + 1})` }} />
                {c.name}
              </Chip>
            ))}
          </div>
          <SearchableSelect
            value={chips.some((c) => c.id === categoryId) ? "" : categoryId}
            onChange={setCategoryId}
            buttonPlaceholder="More categories…"
            placeholder="Search categories…"
            className="w-full"
            options={ofKind.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot, indent: c.indent }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className={caption}>When</span>
          <div className="flex flex-wrap gap-2">
            <Chip selected={postedDate === today} onClick={() => { setPostedDate(today); setPickingDate(false); }}>Today</Chip>
            <Chip selected={postedDate === yesterday} onClick={() => { setPostedDate(yesterday); setPickingDate(false); }}>Yesterday</Chip>
            <Chip selected={customDate} onClick={() => setPickingDate((v) => !v)}>
              <Calendar size={15} strokeWidth={2} className="text-text-2" aria-hidden="true" />
              {customDate ? shortDate(postedDate) : "Pick a date"}
            </Chip>
          </div>
          {pickingDate && (
            <input
              type="date"
              value={postedDate}
              max={today}
              onChange={(e) => e.target.value && setPostedDate(e.target.value)}
              aria-label="Date"
              className={panelInputClass}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className={caption}>{kind === "expense" ? "Paid from" : "Deposited to"}</span>
          <SearchableSelect
            value={accountId}
            onChange={(v) => {
              setAccountId(v);
              setError(null);
            }}
            buttonPlaceholder="Choose an account"
            placeholder="Search accounts…"
            className="w-full"
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} ····${a.mask ?? "----"}` }))}
          />
        </div>
      </FormPanel>
    </>
  );
}
