/**
 * Copy and step rows for the connect / reconnect progress dialog, shared by
 * web's SyncDialog and mobile's ProgressSheet so both say the same thing.
 * Rows come only from what we actually know: the account types picked in
 * Plaid Link and the failures[] the exchange/sync routes return. Nothing
 * ticks off until the request comes back -- the exchange is one request, so
 * a row-by-row tick would be invented.
 */

export type SyncDialogMode = "create" | "update";
export type SyncDialogPhase = "syncing" | "slow" | "success" | "partial" | "failed";

/** After this long still syncing, the dialog switches to its "slow" phase. */
export const SYNC_SLOW_AFTER_MS = 20_000;
/** How long a clean success stays up before the dialog closes itself. */
export const SYNC_SUCCESS_HOLD_MS: Record<SyncDialogMode, number> = { create: 1200, update: 900 };

export type SyncStepKey = "accounts" | "transactions" | "credit" | "investments";

export interface SyncStepRow {
  key: SyncStepKey;
  label: string;
  /** e.g. "4 accounts" on the accounts row. */
  detail: string | null;
  status: "pending" | "done" | "failed";
}

const STEP_LABEL: Record<SyncStepKey, string> = {
  accounts: "Accounts and balances",
  transactions: "Transactions",
  credit: "Credit card details",
  investments: "Investments",
};

/** Which row a sync failure's product belongs to (products from apps/web/lib/syncSteps.ts). */
const PRODUCT_STEP: Record<string, SyncStepKey> = {
  balances: "accounts",
  transactions: "transactions",
  liabilities: "credit",
  holdings: "investments",
  investments: "investments",
};

const ORDER: SyncStepKey[] = ["accounts", "transactions", "credit", "investments"];

export function accountCountLabel(n: number): string {
  return `${n} account${n === 1 ? "" : "s"}`;
}

/**
 * accountTypes: Plaid account types picked in Link ("depository", "credit",
 * "investment", "loan", ...). failures: null while still running.
 */
export function syncSteps(accountTypes: string[], failures: { product: string }[] | null): SyncStepRow[] {
  const keys = new Set<SyncStepKey>(["accounts"]);
  const known = accountTypes.length > 0;
  if (!known || accountTypes.some((t) => t === "depository" || t === "credit")) keys.add("transactions");
  if (accountTypes.includes("credit")) keys.add("credit");
  if (accountTypes.includes("investment")) keys.add("investments");

  const failed = new Set<SyncStepKey>();
  for (const f of failures ?? []) {
    const key = PRODUCT_STEP[f.product];
    if (!key) continue;
    failed.add(key);
    keys.add(key);
  }

  return ORDER.filter((k) => keys.has(k)).map((key) => ({
    key,
    label: STEP_LABEL[key],
    detail: key === "accounts" && accountTypes.length > 0 ? accountCountLabel(accountTypes.length) : null,
    status: failures === null ? "pending" : failed.has(key) ? "failed" : "done",
  }));
}

/** Joins ["transactions", "credit card details"] as "transactions and credit card details". */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export interface ErrorCopy {
  subtitle: string;
  body: string;
}

/**
 * Plain-language copy for a failed connect. `code` is a Plaid error_code when
 * we have one, "NETWORK" for a request that never reached the server, or
 * null. The raw code is for logs only -- never shown. `stage` is where it
 * failed: inside Plaid Link ("link") or saving afterwards ("save").
 */
export function connectErrorCopy(code: string | null | undefined, bank: string, stage: "link" | "save" = "save"): ErrorCopy {
  switch (code) {
    case "INSTITUTION_NOT_RESPONDING":
    case "INSTITUTION_DOWN":
    case "INSTITUTION_NOT_AVAILABLE":
      return { subtitle: `${bank} isn't responding right now`, body: `This is on ${bank}'s side. Try again in a few minutes.` };
    case "INSTITUTION_NOT_SUPPORTED":
    case "NO_ACCOUNTS":
      return {
        subtitle: "No accounts Tally can use",
        body: `${bank} didn't share any accounts Tally supports. Connect again and pick a chequing, savings, credit or investment account.`,
      };
    case "RATE_LIMIT_EXCEEDED":
      return { subtitle: "Too many attempts", body: "Wait a minute, then connect again." };
    case "NETWORK":
      return { subtitle: "You're offline", body: "Tally couldn't reach the server. Check your connection and try again." };
    default:
      return {
        subtitle: "Something went wrong",
        body:
          stage === "link"
            ? `Plaid couldn't finish connecting to ${bank}. Connect again to retry.`
            : `You signed in to ${bank}, but Tally couldn't save the connection. Connect again to retry.`,
      };
  }
}

export interface SyncDialogCopy {
  title: string;
  subtitle: string;
  /** Paragraph under the steps, when the phase has one. */
  body: string | null;
}

export function syncDialogCopy({
  mode,
  phase,
  institutionName,
  accountCount,
  failureLabels = [],
  errorCode = null,
  errorStage = "save",
}: {
  mode: SyncDialogMode;
  phase: SyncDialogPhase;
  institutionName: string | null;
  accountCount: number;
  failureLabels?: string[];
  errorCode?: string | null;
  errorStage?: "link" | "save";
}): SyncDialogCopy {
  const bank = institutionName ?? "your bank";
  const Bank = institutionName ?? "Your bank";
  const running = mode === "create" ? `Connecting ${bank}` : `Reconnecting ${bank}`;

  switch (phase) {
    case "syncing":
      return {
        title: running,
        subtitle: mode === "create" ? "Usually takes 10–30 seconds" : "Catching up on what changed while it was disconnected",
        body: null,
      };
    case "slow":
      return {
        title: running,
        subtitle: "Taking longer than usual",
        body: "Some banks are slow to respond through Plaid, and a long transaction history adds time. Keep this open; it will finish on its own.",
      };
    case "success":
      return {
        title: mode === "create" ? `${Bank} is connected` : `${Bank} is reconnected`,
        subtitle: mode === "create" && accountCount > 0 ? `${accountCountLabel(accountCount)} added` : "Everything is caught up",
        body: null,
      };
    case "partial": {
      const n = failureLabels.length;
      const gaps = n === 1 ? "one gap" : `${n} gaps`;
      return {
        title: mode === "create" ? `Connected, with ${gaps}` : `Reconnected, with ${gaps}`,
        subtitle: accountCount > 0 ? `${Bank} · ${accountCountLabel(accountCount)}` : Bank,
        body: `${Bank} didn't send ${joinLabels(failureLabels)} this time. Tally will try again on the next sync. Everything else is ready.`,
      };
    }
    case "failed":
      if (mode === "update" && errorStage === "save") {
        return {
          title: `Couldn't refresh ${bank}`,
          subtitle: "The catch-up sync didn't finish",
          body: "You're signed in again, but the catch-up sync failed. Tally will retry automatically, or you can try now.",
        };
      }
      return { title: mode === "create" ? `Couldn't connect ${bank}` : `Couldn't reconnect ${bank}`, ...connectErrorCopy(errorCode, bank, errorStage) };
  }
}
