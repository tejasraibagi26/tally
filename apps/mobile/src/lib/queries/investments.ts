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
}

export function useInvestmentTransactions() {
  return useQuery({
    queryKey: ["investments", "transactions"],
    queryFn: () => apiGet<{ transactions: InvestmentTransactionRow[] }>("/api/investments/transactions"),
  });
}
