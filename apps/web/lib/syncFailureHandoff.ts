// The Plaid Link success handlers (components/plaid/LinkButton.tsx and
// app/plaid/oauth/page.tsx) navigate to /accounts right after exchanging the
// token — sessionStorage is how a partial-sync-failure notice survives that
// navigation to be shown on the page the user lands on.
const KEY = "tally_sync_failure_handoff";

export interface SyncFailureHandoff {
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

export function saveSyncFailureHandoff(handoff: SyncFailureHandoff) {
  if (handoff.failures.length === 0) return;
  window.sessionStorage.setItem(KEY, JSON.stringify(handoff));
}

export function readAndClearSyncFailureHandoff(): SyncFailureHandoff | null {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as SyncFailureHandoff;
  } catch {
    return null;
  }
}
