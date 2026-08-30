/** Canned holdings/investment-transactions for MOCK_MODE, keyed by account subtype (lib/mock/fixtures.ts). */

export interface MockHoldingSeed {
  ticker: string;
  name: string;
  type: string; // equity | etf | cash — matches Plaid's Security.type values
  isCashEquivalent?: boolean;
  quantity: number;
  costBasisPerShare: number; // dollars
  price: number; // dollars
}

const BROKERAGE_HOLDINGS: MockHoldingSeed[] = [
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", type: "etf", quantity: 620.5, costBasisPerShare: 210, price: 268.42 },
  { ticker: "AAPL", name: "Apple Inc.", type: "equity", quantity: 85, costBasisPerShare: 145.2, price: 227.16 },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", type: "etf", quantity: 300, costBasisPerShare: 55.1, price: 61.83 },
  { ticker: "CUR:USD", name: "Cash", type: "cash", isCashEquivalent: true, quantity: 4231.9, costBasisPerShare: 1, price: 1 },
];

const ROTH_HOLDINGS: MockHoldingSeed[] = [
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", type: "etf", quantity: 110, costBasisPerShare: 380, price: 512.77 },
  { ticker: "CUR:USD", name: "Cash", type: "cash", isCashEquivalent: true, quantity: 812.4, costBasisPerShare: 1, price: 1 },
];

export function holdingsForSubtype(subtype: string): MockHoldingSeed[] {
  switch (subtype) {
    case "brokerage":
      return BROKERAGE_HOLDINGS;
    case "roth":
      return ROTH_HOLDINGS;
    default:
      return [];
  }
}

export interface MockInvestmentTransactionSeed {
  daysAgo: number;
  ticker: string | null; // null = cash-only transaction (e.g. a transfer)
  name: string;
  quantity: number;
  amount: number; // dollars — positive when cash is debited (buys), negative when credited (sells/dividends), matching Plaid's convention
  price: number;
  type: string;
  subtype: string;
}

const BROKERAGE_TRANSACTIONS: MockInvestmentTransactionSeed[] = [
  { daysAgo: 5, ticker: "VTI", name: "Buy VTI", quantity: 10, amount: 2684.2, price: 268.42, type: "buy", subtype: "buy" },
  { daysAgo: 20, ticker: "AAPL", name: "Dividend", quantity: 0, amount: -42.5, price: 0, type: "cash", subtype: "dividend" },
  { daysAgo: 35, ticker: null, name: "Account transfer", quantity: 0, amount: -1000, price: 0, type: "transfer", subtype: "transfer" },
];

const ROTH_TRANSACTIONS: MockInvestmentTransactionSeed[] = [
  { daysAgo: 15, ticker: "VOO", name: "Buy VOO", quantity: 2, amount: 1025.54, price: 512.77, type: "buy", subtype: "buy" },
  // type:"cash" subtype:"contribution" (payroll/manual retirement contributions) is a distinct
  // bucket from type:"transfer" -- portfolioSimpleReturn previously only matched "transfer" and
  // silently missed this, counting real contributions as "return." Exercising it here so that
  // regression doesn't slip back in unnoticed the way it did the first time.
  { daysAgo: 8, ticker: null, name: "Contribution", quantity: 0, amount: -500, price: 0, type: "cash", subtype: "contribution" },
];

export function investmentTransactionsForSubtype(subtype: string): MockInvestmentTransactionSeed[] {
  switch (subtype) {
    case "brokerage":
      return BROKERAGE_TRANSACTIONS;
    case "roth":
      return ROTH_TRANSACTIONS;
    default:
      return [];
  }
}
