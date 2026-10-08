import { describe, expect, it } from "vitest";
import { pairReattached, type PairableRow } from "./reattachPairing";

const row = (id: string, o: Partial<PairableRow> = {}): PairableRow => ({
  id,
  accountId: "acct",
  postedDate: "2026-09-12",
  amount: -4210,
  name: "LOBLAWS #1023",
  merchantName: "Loblaws",
  ...o,
});

describe("pairReattached", () => {
  it("pairs the same charge across the two connections", () => {
    const pairs = pairReattached([row("old")], [row("new")]);
    expect(pairs.map(([o, n]) => [o.id, n.id])).toEqual([["old", "new"]]);
  });

  it("pairs two identical charges one-to-one, never twice", () => {
    const pairs = pairReattached([row("o1"), row("o2")], [row("n1"), row("n2"), row("n3")]);
    expect(pairs).toHaveLength(2);
    expect(new Set(pairs.map(([, n]) => n.id)).size).toBe(2);
  });

  it("falls back to date + amount when the name changed, if that's unambiguous", () => {
    const pairs = pairReattached([row("old", { merchantName: null, name: "LOBLAWS 1023 TORONTO" })], [row("new")]);
    expect(pairs).toHaveLength(1);
  });

  it("doesn't guess between two same-day same-amount charges with different names", () => {
    const kept = [row("o1", { merchantName: "Uber" }), row("o2", { merchantName: "Lyft" })];
    const fresh = [row("n1", { merchantName: "Uber Trip" }), row("n2", { merchantName: "Lyft Ride" })];
    expect(pairReattached(kept, fresh)).toEqual([]);
  });

  it("keeps different accounts, dates and amounts apart", () => {
    const kept = [row("o1", { accountId: "a" }), row("o2", { postedDate: "2026-09-13" }), row("o3", { amount: -100 })];
    expect(pairReattached(kept, [row("new", { accountId: "b" })])).toEqual([]);
  });

  it("leaves kept history older than the re-pull alone", () => {
    const pairs = pairReattached([row("ancient", { postedDate: "2023-01-01" }), row("old")], [row("new")]);
    expect(pairs.map(([o]) => o.id)).toEqual(["old"]);
  });
});
