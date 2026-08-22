// OAuth institutions leave the page during Link, so the in-flight link token
// and mode have to survive a full navigation round trip. sessionStorage is
// enough — it's scoped to the tab and cleared once consumed.
const KEY = "tally_plaid_link_session";

export interface PlaidLinkSession {
  linkToken: string;
  mode: "create" | "update";
  itemId?: string;
}

export function savePlaidLinkSession(session: PlaidLinkSession) {
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function readPlaidLinkSession(): PlaidLinkSession | null {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlaidLinkSession;
  } catch {
    return null;
  }
}

export function clearPlaidLinkSession() {
  window.sessionStorage.removeItem(KEY);
}
