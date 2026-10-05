import type { ConnectionBadge } from "@tally/core/connectionState";

// Plain, serializable shapes the server Accounts page hands its client view.

export interface AccountView {
  id: string;
  /** nickname ?? real name, already resolved. */
  name: string;
  realName: string;
  nickname: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  currency: string;
  creditLimit: number | null;
}

export interface SyncRunView {
  id: string;
  kind: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  added: number;
  modified: number;
  removed: number;
  error: string | null;
}

export interface ConnectionView {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  badge: ConnectionBadge;
  createdAt: string;
  /** Net across this connection's accounts in the base currency (debts subtracted). */
  total: number;
  accounts: AccountView[];
  /** Newest first, at most 10 -- the bank panel's sync history. */
  runs: SyncRunView[];
}
