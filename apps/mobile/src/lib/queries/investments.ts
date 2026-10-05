import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface HoldingRow {
  accountId: string;
  accountName: string;
  securityId: string;
  ticker: string | null;
  securityName: string | null;
  assetType: string;
  isCashEquivalent: boolean;
  quantity: string;
  institutionValue: number;
  costBasis: number | null;
  currency: string;
  originalCurrency: string;
  /** Cents per share, converted like institutionValue. */
  institutionPrice: number | null;
  priceAsOf: string | null;
  /** Bank connection behind the account -- for marking stale holdings. */
  itemId: string | null;
  asOfDate: string;
}

export interface AllocationSlice {
  label: string;
  value: number;
  pct: number;
}

export interface HoldingsResponse {
  holdings: HoldingRow[];
  value: number;
  allocation: AllocationSlice[];
  unrealizedGain: { gain: number; hasCostBasis: boolean };
  simpleReturn: { value: number; investedValue: number; hasHistory: boolean };
}

export function useHoldings() {
  return useQuery({
    queryKey: ["investments", "holdings"],
    queryFn: () => apiGet<HoldingsResponse>("/api/investments/holdings"),
  });
}

export interface InvestmentTransactionRow {
  id: string;
  accountId: string;
  date: string;
  name: string | null;
  quantity: string | null;
  amount: number;
  price: number | null;
  fees: number | null;
  type: string | null;
  subtype: string | null;
  ticker: string | null;
  securityName: string | null;
  securityId: string | null;
  accountName: string;
  /** Converted to the portfolio's currency server-side, like holdings. */
  currency: string;
  originalCurrency: string;
}

export function useInvestmentTransactions() {
  return useQuery({
    queryKey: ["investments", "transactions"],
    queryFn: () => apiGet<{ transactions: InvestmentTransactionRow[] }>("/api/investments/transactions"),
  });
}

export interface HistoryPoint {
  date: string;
  value: number;
  invested: number;
}

/** Daily value and money-in for the Investments chart (one fetch serves every range). */
export function useInvestmentHistory() {
  return useQuery({
    queryKey: ["investments", "history"],
    queryFn: () => apiGet<{ points: HistoryPoint[] }>("/api/investments/history"),
  });
}
