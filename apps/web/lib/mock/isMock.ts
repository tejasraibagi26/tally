export function isMockPlaidItemId(plaidItemId: string): boolean {
  return plaidItemId.startsWith("mock-item-");
}
