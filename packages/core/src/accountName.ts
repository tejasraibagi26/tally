/**
 * The name to display for an account anywhere in the UI: the user's own
 * nickname when they've set one, otherwise the real Plaid-provided name.
 * A blank/whitespace-only nickname counts as "not set" -- the caller is
 * expected to have already normalized that to null on write (see
 * apps/web/app/api/accounts/[id]/route.ts), but this stays defensive since
 * some rows may have been written before that normalization existed.
 */
export function accountDisplayName(name: string, nickname: string | null | undefined): string {
  return nickname?.trim() || name;
}
