
/** Same set as the server's itemStatusToBadge (apps/web/lib/freshness.ts). */
export type ConnectionBadge = "good" | "warning" | "serious" | "critical" | "syncing";

/** The connection fields the contract reads -- satisfied by the web page's DB rows and mobile's /api/accounts institutions alike. */
export interface ConnectionInput {
  institutionName: string | null;
  /** Raw plaid_items.status: healthy | login_required | revoked | error | pending_expiration. */
  status: string;
  lastSyncedAt: string | Date | null;
  badge: ConnectionBadge;
}

/**
 * The Accounts page's whole health contract in one place, shared by web and
 * mobile so both apps say the same thing about the same connection: every connection's
 * server status (badge + raw Plaid status) plus whatever is happening to it
 * on this device right now resolves to one level, one status line, at most
 * one notice and at most one action. Cards only render what this returns,
 * so copy and severity can't drift between the card, the attention strip
 * and the Fix sheet.
 *
 * Levels, quietest first:
 *   quiet   -- healthy; a dot and "Synced 12m ago", nothing else
 *   info    -- something to know, nothing to do (or only waiting)
 *   act     -- still syncing, but needs a tap soon
 *   blocked -- syncing has stopped until the user acts; balances dim
 */
export type ConnectionLevel = "quiet" | "info" | "act" | "blocked";

/** Theme color token the card's dot, notice and button are drawn in. */
export type ConnectionTone = "positive" | "warning" | "negative" | "info" | "brand" | "neutral";

/** signIn opens Plaid Link in update mode; refresh re-pulls this item's balances. */
export type ConnectionActionKind = "signIn" | "refresh" | "remove";

export interface ConnectionAction {
  kind: ConnectionActionKind;
  label: string;
}

export interface ConnectionState {
  level: ConnectionLevel;
  tone: ConnectionTone;
  statusLine: string;
  /** Spinner in place of the status dot. */
  busy: boolean;
  notice?: { title: string; body: string };
  action?: ConnectionAction;
  /** Shown beside `action` (revoked only: "Disconnect" as an equal choice). */
  secondaryAction?: ConnectionAction;
  /** This card's own action is in flight. */
  actionPending: boolean;
  /** Balances can't update, so they render muted with an "as of" total. */
  dimBalances: boolean;
  /** Starts collapsed to its total; the rows are one tap away. */
  collapsed: boolean;
  /** Sort key, lowest first. */
  rank: number;
  /** Counts toward the "N banks need you" strip and the Fix sheet. */
  needsAttention: boolean;
}

export interface LocalConnectionState {
  /** A per-item balance refresh is in flight. */
  refreshing: boolean;
  /** Plaid Link is open for this item. */
  linking: boolean;
  /** Plaid Link just finished successfully for this item. */
  justReconnected: boolean;
  /** The last manual refresh of this item failed (mobile: the in-app mutation; web: the latest manual sync_runs row). */
  refreshFailed: boolean;
}

const HOUR = 3_600_000;

export function ago(when: string | Date | null, now = Date.now()): string {
  if (!when) return "never";
  const mins = Math.max(0, Math.round((now - new Date(when).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function daysSince(when: string | Date, now: number): number {
  return Math.max(1, Math.floor((now - new Date(when).getTime()) / (24 * HOUR)));
}

export function connectionState(inst: ConnectionInput, local: LocalConnectionState, now = Date.now()): ConnectionState {
  const bank = inst.institutionName ?? "Your bank";
  const synced = `Synced ${ago(inst.lastSyncedAt, now)}`;
  const base = resolveServerState(inst, local, bank, synced, now);

  // Local, in-flight states sit on top of whatever the server says.
  if (local.linking) {
    return {
      ...base,
      notice: { title: `Waiting for ${bank}…`, body: "Finish signing in on the Plaid screen." },
      actionPending: true,
    };
  }
  if (local.justReconnected) {
    return {
      ...base,
      level: "info",
      tone: "brand",
      statusLine: local.refreshing ? "Catching up…" : synced,
      busy: local.refreshing,
      notice: { title: "You're reconnected", body: "Syncing has restarted for this bank." },
      action: undefined,
      secondaryAction: undefined,
      dimBalances: false,
      collapsed: false,
      // Hold its place at the top until the confirmation fades, so the card
      // doesn't jump out from under the user's thumb the moment it's fixed.
      rank: 0,
      needsAttention: false,
    };
  }
  if (local.refreshing) {
    return { ...base, statusLine: "Syncing…", busy: true, actionPending: base.action?.kind === "refresh" };
  }
  return base;
}

function resolveServerState(
  inst: ConnectionInput,
  local: LocalConnectionState,
  bank: string,
  synced: string,
  now: number,
): ConnectionState {
  const quiet: ConnectionState = {
    level: "quiet",
    tone: "positive",
    statusLine: synced,
    busy: false,
    actionPending: false,
    dimBalances: false,
    collapsed: false,
    rank: 3,
    needsAttention: false,
  };
  const signInAgain: ConnectionAction = { kind: "signIn", label: "Sign in again" };

  switch (inst.status) {
    case "login_required":
      return {
        ...quiet,
        level: "blocked",
        tone: "negative",
        statusLine: inst.lastSyncedAt ? `Paused · ${ago(inst.lastSyncedAt, now)}` : "Paused",
        notice: { title: "Sign-in expired", body: `${bank} signed Tally out. Sign in again to resume syncing. Nothing is lost.` },
        action: { kind: "signIn", label: "Sign in" },
        dimBalances: true,
        collapsed: true,
        rank: 0,
        needsAttention: true,
      };
    case "revoked":
      return {
        ...quiet,
        level: "blocked",
        tone: "negative",
        statusLine: inst.lastSyncedAt ? `Disconnected · ${ago(inst.lastSyncedAt, now)}` : "Disconnected",
        notice: { title: "Access was turned off", body: `Tally's access was removed from ${bank}'s side. Reconnect, or disconnect it to stop seeing this. Its history stays.` },
        action: { kind: "signIn", label: "Reconnect" },
        secondaryAction: { kind: "remove", label: "Disconnect" },
        dimBalances: true,
        collapsed: true,
        rank: 0,
        needsAttention: true,
      };
    case "error": {
      // Usually the bank's (or Plaid's) side, so a retry comes first; signing
      // in again is the fallback once it has been down a full day or a manual
      // retry has already failed.
      const longDown = !inst.lastSyncedAt || now - new Date(inst.lastSyncedAt).getTime() > 24 * HOUR;
      const escalate = longDown || local.refreshFailed;
      return {
        ...quiet,
        level: "act",
        tone: "warning",
        statusLine: `Last synced ${ago(inst.lastSyncedAt, now)}`,
        notice: escalate
          ? { title: `${bank} still isn't responding`, body: "Retrying hasn't worked. Signing in again usually fixes this." }
          : { title: `${bank} isn't responding`, body: "This is usually on the bank's side. Try again in a moment." },
        action: escalate ? signInAgain : { kind: "refresh", label: "Retry" },
        dimBalances: true,
        rank: 1,
        needsAttention: true,
      };
    }
    case "pending_expiration":
      return {
        ...quiet,
        level: "act",
        tone: "warning",
        statusLine: "Access ending soon",
        notice: { title: "Renew access", body: `${bank} asks you to re-approve Tally from time to time. It takes under a minute.` },
        action: { kind: "signIn", label: "Renew" },
        rank: 1,
        needsAttention: true,
      };
  }

  switch (inst.badge) {
    case "syncing":
      return {
        ...quiet,
        level: "info",
        tone: "info",
        statusLine: inst.lastSyncedAt ? synced : "Connected",
        notice: { title: "Importing transactions", body: `${bank} can take a few hours to send your history. Nothing to do on your side.` },
        rank: 2,
      };
    case "serious":
      if (!inst.lastSyncedAt) {
        return {
          ...quiet,
          level: "act",
          tone: "warning",
          statusLine: "No data yet",
          notice: local.refreshFailed
            ? { title: "Nothing has arrived yet", body: "A manual sync didn't work either. Signing in again usually fixes this." }
            : { title: "Nothing has arrived yet", body: `${bank} hasn't sent any data since you connected it.` },
          action: local.refreshFailed ? signInAgain : { kind: "refresh", label: "Sync now" },
          rank: 1,
          needsAttention: true,
        };
      }
      return {
        ...quiet,
        level: "act",
        tone: "warning",
        statusLine: synced,
        notice: local.refreshFailed
          ? { title: `Hasn't synced in ${daysSince(inst.lastSyncedAt, now)} days`, body: "A manual sync didn't work. Signing in again usually fixes this." }
          : { title: `Hasn't synced in ${daysSince(inst.lastSyncedAt, now)} days`, body: "Try a manual sync. If it keeps failing, sign in again." },
        action: local.refreshFailed ? signInAgain : { kind: "refresh", label: "Sync now" },
        rank: 1,
        needsAttention: true,
      };
    case "warning":
      // 6–48h behind is normal for banks that sync once a day: color the
      // status line, but no notice.
      return { ...quiet, level: "info", tone: "warning", rank: 3 };
    default:
      return quiet;
  }
}
