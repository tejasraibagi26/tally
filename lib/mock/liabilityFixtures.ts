/** Canned credit-card liability for MOCK_MODE, keyed by account subtype (lib/mock/fixtures.ts). */

export interface MockLiabilitySeed {
  aprs: { aprPercentage: number; aprType: string; balanceSubjectToApr: number; interestChargeAmount: number }[];
  isOverdue: boolean;
  lastPaymentAmount: number; // dollars
  lastPaymentDaysAgo: number;
  lastStatementBalance: number;
  lastStatementIssueDaysAgo: number;
  minimumPaymentAmount: number;
  nextPaymentDueInDays: number;
}

const CREDIT_CARD_LIABILITY: MockLiabilitySeed = {
  aprs: [{ aprPercentage: 24.99, aprType: "purchase_apr", balanceSubjectToApr: 1200.5, interestChargeAmount: 24.95 }],
  isOverdue: false,
  lastPaymentAmount: 250,
  lastPaymentDaysAgo: 12,
  lastStatementBalance: 1345.82,
  lastStatementIssueDaysAgo: 18,
  minimumPaymentAmount: 35,
  nextPaymentDueInDays: 9,
};

export function liabilityForSubtype(subtype: string): MockLiabilitySeed | null {
  return subtype === "credit card" ? CREDIT_CARD_LIABILITY : null;
}
