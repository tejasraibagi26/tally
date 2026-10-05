import { describe, expect, it } from "vitest";
import {
  allocationBy,
  buildPortfolioHistory,
  describeInvestmentTxn,
  rollUpPositions,
  summarizeRange,
  unrealizedGainTotal,
  type HoldingInput,
  type TxnInput,
} from "./investments";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const h = (o: Partial<HoldingInput>): HoldingInput => ({
  accountId: "tfsa",
  accountName: "TFSA",
  securityId: "vfv",
  ticker: "VFV",
  securityName: "Vanguard S&P 500",
  assetType: "etf",
  isCashEquivalent: false,
  quantity: "10",
  institutionValue: 100_000,
  costBasis: 80_000,
  originalCurrency: "CAD",
  ...o,
});

describe("rollUpPositions", () => {
  it("merges one security across accounts into a position with lots", () => {
    const [vfv, cash] = rollUpPositions([
      h({}),
      h({ accountId: "rrsp", accountName: "RRSP", quantity: "5.5", institutionValue: 50_000, costBasis: 45_000 }),
      h({ securityId: "cash", ticker: "CASH", assetType: "cash", isCashEquivalent: true, institutionValue: 10_000, costBasis: null }),
    ]);
    expect(vfv).toMatchObject({ quantity: 15.5, value: 150_000, costBasis: 125_000, gain: { amount: 25_000, pct: 0.2 } });
    expect(vfv!.weight).toBeCloseTo(150 / 160);
    expect(vfv!.lots.map((l) => l.accountName)).toEqual(["TFSA", "RRSP"]);
    expect(cash!.gain).toBeNull();
  });

  it("drops the gain when any lot lacks cost basis", () => {
    const [p] = rollUpPositions([h({}), h({ accountId: "rrsp", costBasis: null })]);
    expect(p!.costBasis).toBeNull();
    expect(p!.gain).toBeNull();
    expect(p!.lots[0]!.gain).not.toBeNull();
  });

  it("totals unrealized gain over covered, non-cash positions", () => {
    const positions = rollUpPositions([h({}), h({ securityId: "aapl", costBasis: null }), h({ securityId: "c", isCashEquivalent: true, costBasis: null })]);
    expect(unrealizedGainTotal(positions)).toEqual({ amount: 20_000, covered: 1, total: 2 });
  });
});

describe("allocationBy", () => {
  const hs = [h({}), h({ accountId: "rrsp", accountName: "RRSP", securityId: "xbb", ticker: "XBB", assetType: "fixed income", institutionValue: 50_000 }), h({ securityId: "c", isCashEquivalent: true, assetType: "cash", institutionValue: 50_000 })];
  it("groups by type, account or holding", () => {
    expect(allocationBy(hs, "type").map((s) => s.label)).toEqual(["ETF", "Fixed Income", "Cash"]);
    expect(allocationBy(hs, "account")).toEqual([
      { label: "TFSA", value: 150_000, pct: 0.75 },
      { label: "RRSP", value: 50_000, pct: 0.25 },
    ]);
  });
  it("folds small holdings into an 'others' slice", () => {
    const many = Array.from({ length: 8 }, (_, i) => h({ securityId: `s${i}`, ticker: `T${i}`, institutionValue: 1000 * (8 - i) }));
    const slices = allocationBy(many, "holding");
    expect(slices).toHaveLength(6);
    expect(slices[5]!.label).toBe("3 others");
  });
});

describe("describeInvestmentTxn", () => {
  const t = (o: Partial<TxnInput>): TxnInput => ({ type: null, subtype: null, name: null, ticker: "XEQT", securityName: "iShares Core Equity", quantity: null, price: null, amount: 0, ...o });
  it("words trades with a verb, quantity and price, unsigned and neutral", () => {
    expect(describeInvestmentTxn(t({ type: "buy", subtype: "buy", quantity: "12", price: 3410, amount: 40_920 }), money)).toMatchObject({
      title: "Bought 12 XEQT",
      detail: "$34.10 each",
      tone: "neutral",
      filter: "trades",
      amount: 40_920,
      signed: false,
    });
    expect(describeInvestmentTxn(t({ type: "sell", subtype: "sell", quantity: "-5", amount: -115_040 }), money)).toMatchObject({ title: "Sold 5 XEQT", amount: 115_040 });
  });
  it("shows a dividend as money in, in green (Plaid sends it negative)", () => {
    expect(describeInvestmentTxn(t({ type: "cash", subtype: "dividend", ticker: "VFV", amount: -3812 }), money)).toMatchObject({
      title: "Dividend from VFV",
      tone: "positive",
      filter: "income",
      amount: 3812,
      signed: true,
    });
  });
  it("treats contributions and withdrawals as neutral money in/out", () => {
    expect(describeInvestmentTxn(t({ type: "cash", subtype: "contribution", amount: -150_000 }), money)).toMatchObject({ title: "Contribution", amount: 150_000, tone: "neutral" });
    expect(describeInvestmentTxn(t({ type: "cash", subtype: "withdrawal", amount: 80_000 }), money)).toMatchObject({ title: "Withdrawal", amount: -80_000 });
  });
  it("shows fees as money out in coral", () => {
    expect(describeInvestmentTxn(t({ type: "fee", subtype: "account fee", name: "FEE", amount: 499 }), money)).toMatchObject({ title: "Account fee", tone: "negative", amount: -499 });
  });
});

describe("buildPortfolioHistory", () => {
  it("carries accounts forward, adds contributions and late-joining accounts to invested", () => {
    const history = buildPortfolioHistory(
      [
        { accountId: "a", date: "2026-01-01", value: 1000 },
        { accountId: "a", date: "2026-01-02", value: 1100 },
        { accountId: "b", date: "2026-01-03", value: 500 },
        { accountId: "a", date: "2026-01-04", value: 1400 },
      ],
      [
        { date: "2025-12-31", amount: -999 }, // before history: already inside the first value
        { date: "2026-01-04", amount: -200 },
      ],
    );
    expect(history).toEqual([
      { date: "2026-01-01", value: 1000, invested: 1000 },
      { date: "2026-01-02", value: 1100, invested: 1000 },
      { date: "2026-01-03", value: 1600, invested: 1500 },
      { date: "2026-01-04", value: 1900, invested: 1700 },
    ]);
  });

  it("summarizes growth and money added over a range", () => {
    const history = [
      { date: "2026-08-01", value: 1000, invested: 1000 },
      { date: "2026-09-10", value: 1300, invested: 1150 },
      { date: "2026-10-05", value: 1500, invested: 1200 },
    ];
    expect(summarizeRange(history, "1M", "2026-10-05")).toMatchObject({ growth: 150, added: 50, covered: true });
    expect(summarizeRange(history, "1Y", "2026-10-05")).toMatchObject({ growth: 300, added: 200, covered: false });
  });
});
