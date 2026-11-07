"use client";

import { useState } from "react";

/**
 * A delete that asks first, inline: the button turns into "Remove X?" with
 * a coral confirm and a Cancel. Nothing is removed on the first click.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel = "Yes, remove",
  onConfirm,
  disabled,
}: {
  label: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="tn-btn tn-btn-sm" style={{ color: "#ff9c8c" }} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span role="group" aria-label={question} style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14 }}>{question}</span>
      <button
        type="button"
        className="tn-btn tn-btn-sm tn-btn-coral"
        disabled={disabled}
        onClick={async () => {
          await onConfirm();
          setAsking(false);
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="tn-btn tn-btn-sm" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
