"use client";

import { useState } from "react";
import { useMutate } from "@/components/new/useMutate";
import { ConfirmButton } from "@/components/new/ConfirmButton";

interface Option {
  id: string;
  name: string;
}

/** One rule: its sentence, an on/off switch, and Remove (asks first). */
export function RuleRow({ id, sentence, enabled }: { id: string; sentence: string; enabled: boolean }) {
  const { run, busy } = useMutate();
  const [on, setOn] = useState(enabled);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", padding: "16px 0", borderTop: "1px solid var(--tn-line)" }}>
      <span style={{ flex: "1 1 320px", minWidth: 0, fontSize: 15, color: on ? "var(--tn-ink)" : "var(--tn-faint)" }}>{sentence}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? "Turn this rule off" : "Turn this rule on"}
        disabled={busy}
        onClick={async () => {
          setOn(!on);
          if (!(await run("PATCH", `/api/rules/${id}`, { enabled: !on }))) setOn(on);
        }}
        style={{ width: 56, height: 32, borderRadius: 999, border: 0, padding: 3, background: on ? "var(--tn-lime)" : "#3a3a33", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}
      >
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: on ? "var(--tn-bg)" : "var(--tn-ink)" }} />
      </button>
      <ConfirmButton label="Remove" question="Remove this rule?" disabled={busy} onConfirm={async () => void (await run("DELETE", `/api/rules/${id}`, undefined, "Rule removed"))} />
    </div>
  );
}

/** "When the merchant contains X, file it under Y (or tag it Z)". Anything fancier is in the advanced editor. */
export function NewRule({ categories }: { categories: Option[] }) {
  const { run, busy } = useMutate();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<"merchant" | "description">("merchant");
  const [text, setText] = useState("");
  const [action, setAction] = useState<"category" | "tag" | "exclude">("category");
  const [categoryId, setCategoryId] = useState("");
  const [tag, setTag] = useState("");
  const [applyToExisting, setApply] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);

  const match = { field, op: "contains" as const, value: text.trim() };
  const actions = action === "category" ? { setCategoryId: categoryId } : action === "tag" ? { addTag: tag.trim().replace(/^#/, "") } : { exclude: true };
  const ready = text.trim() && (action === "category" ? categoryId : action === "tag" ? tag.trim() : true);

  if (!open) {
    return (
      <button type="button" className="tn-btn tn-btn-solid" onClick={() => setOpen(true)}>
        + New rule
      </button>
    );
  }
  return (
    <form
      className="tn-card"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        if (await run("POST", "/api/rules", { match, actions, applyToExisting, enabled: true }, "Rule added")) {
          setOpen(false);
          setText("");
          setTag("");
          setCategoryId("");
          setPreview(null);
        }
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 16 }}>
        <span>When the</span>
        <select className="tn-input" value={field} onChange={(e) => setField(e.target.value as typeof field)} aria-label="Match on">
          <option value="merchant">merchant</option>
          <option value="description">bank description</option>
        </select>
        <span>contains</span>
        <input
          className="tn-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          placeholder="costco"
          aria-label="Text to match"
          style={{ width: 180 }}
          required
          autoFocus
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 16 }}>
        <select className="tn-input" value={action} onChange={(e) => setAction(e.target.value as typeof action)} aria-label="Then">
          <option value="category">file it under</option>
          <option value="tag">tag it</option>
          <option value="exclude">leave it out of totals</option>
        </select>
        {action === "category" && (
          <select className="tn-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category" required>
            <option value="">Pick a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {action === "tag" && <input className="tn-input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#cottage-trip" aria-label="Tag" maxLength={40} required />}
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={applyToExisting} onChange={(e) => setApply(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#c9f26b" }} />
        Also apply it to transactions I already have
        {applyToExisting && text.trim() && (
          <button
            type="button"
            className="tn-btn tn-btn-sm"
            disabled={busy}
            onClick={async () => {
              const r = await run<{ previewCount: number }>("POST", "/api/rules?preview=1", { match });
              if (r) setPreview(r.previewCount);
            }}
          >
            {preview == null ? "How many?" : `${preview} match${preview === 1 ? "es" : ""}`}
          </button>
        )}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy || !ready}>
          Add rule
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
