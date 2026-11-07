"use client";

import { useEffect, useState } from "react";
import { useMutate } from "@/components/new/useMutate";
import { useUiSwitch } from "@/components/new/UiSwitch";

function Row({ title, body, children }: { title: string; body?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 24px", padding: "18px 0", borderTop: "1px solid var(--tn-line)" }}>
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
        {body && <div style={{ fontSize: 14, color: "var(--tn-muted)" }}>{body}</div>}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{ width: 56, height: 32, borderRadius: 999, border: 0, padding: 3, background: on ? "var(--tn-lime)" : "#3a3a33", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start", flex: "none" }}
    >
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: on ? "var(--tn-bg)" : "var(--tn-ink)" }} />
    </button>
  );
}

/** The opt-in itself: on here means Tally opens in the new experience. */
export function NewUiSetting({ on }: { on: boolean }) {
  const { set, busy } = useUiSwitch();
  return (
    <Row title="Use the new Tally" body={on ? "Tally opens here, and the classic screens send you to their new versions." : "Tally opens in the classic view."}>
      <Switch on={on} onChange={(v) => set(v)} label="Use the new Tally" disabled={busy} />
    </Row>
  );
}

export function RecapsSetting({ on: initial }: { on: boolean }) {
  const { run, busy } = useMutate();
  const [on, setOn] = useState(initial);
  return (
    <Row title="Monthly email recap" body="A short email at the start of each month: what came in, what went out, and how your goal is doing.">
      <Switch
        on={on}
        label="Monthly email recap"
        disabled={busy}
        onChange={async (v) => {
          setOn(v);
          if (!(await run("PATCH", "/api/settings/recaps", { enabled: v }, v ? "Recaps on" : "Recaps off"))) setOn(!v);
        }}
      />
    </Row>
  );
}

/** Hide amounts on this device (the same setting as the classic eye icon). */
export function HideAmountsSetting() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem("tally-hide-amounts") === "true");
    } catch {
      /* storage unavailable: leave it off */
    }
  }, []);
  return (
    <Row title="Hide amounts" body="Blurs every dollar figure on this device, for using Tally in public.">
      <Switch
        on={on}
        label="Hide amounts"
        onChange={(v) => {
          setOn(v);
          document.documentElement.setAttribute("data-hide-amounts", v ? "true" : "false");
          try {
            localStorage.setItem("tally-hide-amounts", String(v));
          } catch {
            /* storage unavailable: applies to this page only */
          }
        }}
      />
    </Row>
  );
}

function MoneyInput({ initial, onSave, placeholder, allowEmpty }: { initial: number | null; onSave: (cents: number | null) => Promise<unknown>; placeholder: string; allowEmpty?: boolean }) {
  const [v, setV] = useState(initial != null ? String(initial / 100) : "");
  const [saving, setSaving] = useState(false);
  const cents = v.trim() === "" ? null : Math.round((Number(v.replace(/[^0-9.]/g, "")) || 0) * 100);
  const changed = cents !== initial;
  return (
    <form
      style={{ display: "flex", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (cents == null && !allowEmpty) return;
        setSaving(true);
        await onSave(cents);
        setSaving(false);
      }}
    >
      <input className="tn-input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={{ width: 140 }} />
      <button type="submit" className="tn-btn tn-btn-sm" disabled={!changed || saving || (cents == null && !allowEmpty)} style={{ minHeight: 48 }}>
        Save
      </button>
    </form>
  );
}

export function CushionSetting({ cushion }: { cushion: number }) {
  const { run } = useMutate();
  return (
    <Row title="Buffer" body="Money Tally keeps aside when it works out what's safe to spend and when cash gets tight.">
      <MoneyInput initial={cushion} placeholder="$0" onSave={(c) => run("PUT", "/api/safe-to-spend/settings", { cushion: c ?? 0 }, "Buffer saved")} />
    </Row>
  );
}

export function DailySpendSetting({ cents }: { cents: number | null }) {
  const { run } = useMutate();
  return (
    <Row title="Everyday spending per day" body="Leave empty and Tally estimates it from your last 90 days. Set it if your spending is about to change.">
      <MoneyInput initial={cents} placeholder="Automatic" allowEmpty onSave={(c) => run("PATCH", "/api/forecast/settings", { dailySpendCents: c }, c == null ? "Back to automatic" : "Saved")} />
    </Row>
  );
}

export function CountedAccounts({ accounts }: { accounts: { id: string; label: string; kind: string; counts: boolean }[] }) {
  const { run, busy } = useMutate();
  const [state, setState] = useState(Object.fromEntries(accounts.map((a) => [a.id, a.counts])));
  return (
    <>
      {accounts.map((a) => (
        <Row key={a.id} title={a.label} body={a.kind}>
          <Switch
            on={!!state[a.id]}
            label={`Count ${a.label} as spendable cash`}
            disabled={busy}
            onChange={async (v) => {
              setState((s) => ({ ...s, [a.id]: v }));
              if (!(await run("PUT", "/api/safe-to-spend/settings", { accounts: { [a.id]: v } }))) setState((s) => ({ ...s, [a.id]: !v }));
            }}
          />
        </Row>
      ))}
    </>
  );
}
