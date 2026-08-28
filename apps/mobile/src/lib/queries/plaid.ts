import { apiPost } from "@/lib/api";

// Server-side only: builds a short-lived Link token. This is the only Plaid
// string that ever reaches the client (never an access_token) -- same
// contract the web app's LinkButton uses (app/api/plaid/link-token).
export function createLinkToken(mode: "create" | "update", itemId?: string): Promise<{ linkToken: string }> {
  return apiPost("/api/plaid/link-token", { mode, itemId });
}

// metadata is deliberately omitted: the native SDK's LinkSuccessMetadata
// shape (institution.id) doesn't match what the web SDK sends
// (institution.institution_id), and the server already looks up the
// institution authoritatively via Plaid's own /item/get call regardless --
// metadata there is only ever a fallback for when that lookup is unavailable.
export function exchangePublicToken(publicToken: string): Promise<{ ok: true; itemId: string; institutionName: string | null }> {
  return apiPost("/api/plaid/exchange", { publicToken });
}
