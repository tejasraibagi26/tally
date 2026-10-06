import { describe, expect, it } from "vitest";
import { cardNetwork, cardSortRank, describeCard, isCardPayment, isDarkBrandColor, nextPayment, paidSinceStatement, type CardInput } from "./cardView";

const TODAY = "2026-10-05";

const card = (o: Partial<CardInput> = {}): CardInput => ({
  currentBalance: 138240,
  creditLimit: 800000,
  statementBalance: 124000,
  statementDate: "2026-09-20",
  minimum: 2500,
  dueDate: "2026-10-15",
  isOverdue: false,
  lastPaymentAmount: null,
  lastPaymentDate: null,
  paidFromTransactions: 0,
  ...o,
});

describe("isCardPayment", () => {
  const base = { amount: 98000, isTransfer: false, pfcPrimary: null, pfcDetailed: null, categoryKind: null };
  it("counts Plaid's card-payment and transfer-in tags and transfers", () => {
    expect(isCardPayment({ ...base, pfcDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" })).toBe(true);
    expect(isCardPayment({ ...base, pfcPrimary: "TRANSFER_IN" })).toBe(true);
    expect(isCardPayment({ ...base, isTransfer: true })).toBe(true);
  });
  it("leaves out refunds and money out", () => {
    expect(isCardPayment({ ...base, isTransfer: true, categoryKind: "expense" })).toBe(false);
    expect(isCardPayment({ ...base, pfcPrimary: "GENERAL_MERCHANDISE" })).toBe(false);
    expect(isCardPayment({ ...base, amount: -5000, pfcDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" })).toBe(false);
  });
});

describe("paidSinceStatement", () => {
  it("takes whichever source saw more", () => {
    expect(paidSinceStatement(card({ paidFromTransactions: 98000, lastPaymentAmount: 50000, lastPaymentDate: "2026-09-28" }))).toBe(98000);
    expect(paidSinceStatement(card({ paidFromTransactions: 0, lastPaymentAmount: 124000, lastPaymentDate: "2026-09-28" }))).toBe(124000);
  });
  it("ignores a bank payment from before the statement", () => {
    expect(paidSinceStatement(card({ lastPaymentAmount: 124000, lastPaymentDate: "2026-09-02" }))).toBe(0);
  });
});

describe("describeCard", () => {
  it("is paid in full once payments cover the statement", () => {
    const v = describeCard(card({ paidFromTransactions: 124000 }), TODAY);
    expect(v).toMatchObject({ state: "paid", left: 0, amountDue: null, dueLabel: null });
  });

  it("is paid when the balance is a credit", () => {
    expect(describeCard(card({ currentBalance: -2500 }), TODAY)).toMatchObject({ state: "paid", credit: true });
  });

  it("shows what's left once the minimum is covered", () => {
    const v = describeCard(card({ paidFromTransactions: 98000 }), TODAY);
    expect(v).toMatchObject({ state: "due", paid: 98000, left: 26000, minimumMet: true, amountDue: 26000, dueLabel: "Due Oct 15" });
  });

  it("asks for the rest of the minimum when it isn't covered", () => {
    expect(describeCard(card({ paidFromTransactions: 1000 }), TODAY).amountDue).toBe(1500);
  });

  it("uses the statement balance when the bank reports a $0 minimum on an unpaid statement", () => {
    expect(describeCard(card({ minimum: 0 }), TODAY).amountDue).toBe(124000);
  });

  it("returns null (Min. unknown) with no minimum", () => {
    expect(describeCard(card({ minimum: null }), TODAY).amountDue).toBeNull();
  });

  it("turns due soon within 3 days", () => {
    expect(describeCard(card({ dueDate: "2026-10-07" }), TODAY)).toMatchObject({ state: "dueSoon", dueLabel: "Due in 2 days" });
    expect(describeCard(card({ dueDate: "2026-10-06" }), TODAY).dueLabel).toBe("Due tomorrow");
    expect(describeCard(card({ dueDate: TODAY }), TODAY).dueLabel).toBe("Due today");
  });

  it("is overdue when the bank says so, or the date passed with the minimum unpaid", () => {
    expect(describeCard(card({ isOverdue: true, dueDate: "2026-10-03" }), TODAY)).toMatchObject({ state: "overdue", dueLabel: "Overdue · 2 days", overdueDays: 2 });
    expect(describeCard(card({ dueDate: "2026-10-03" }), TODAY).state).toBe("overdue");
    expect(describeCard(card({ dueDate: "2026-10-03", paidFromTransactions: 2500 }), TODAY).state).toBe("due");
  });

  it("has no statement for a new card", () => {
    expect(describeCard(card({ statementBalance: null, statementDate: null }), TODAY).state).toBe("noStatement");
  });

  it("rates utilization against the 30% line", () => {
    expect(describeCard(card(), TODAY).utilizationTone).toBe("healthy");
    expect(describeCard(card({ currentBalance: 240000 }), TODAY).utilizationTone).toBe("high");
    expect(describeCard(card({ currentBalance: 812000 }), TODAY).utilizationTone).toBe("over");
    expect(describeCard(card({ creditLimit: null }), TODAY)).toMatchObject({ utilization: null, utilizationTone: "none" });
  });
});

describe("nextPayment and sorting", () => {
  it("leads with the overdue card, then the soonest due", () => {
    const cards = [
      { id: "td", dueDate: "2026-10-15", view: describeCard(card(), TODAY) },
      { id: "amex", dueDate: "2026-10-07", view: describeCard(card({ dueDate: "2026-10-07" }), TODAY) },
      { id: "rogers", dueDate: "2026-10-09", view: describeCard(card({ paidFromTransactions: 124000, dueDate: "2026-10-09" }), TODAY) },
    ];
    expect(nextPayment(cards)?.id).toBe("amex");
    expect(nextPayment([...cards, { id: "late", dueDate: "2026-10-03", view: describeCard(card({ isOverdue: true, dueDate: "2026-10-03" }), TODAY) }])?.id).toBe("late");
    expect(nextPayment([cards[2]!])).toBeNull();
    expect(cardSortRank(cards[2]!.view)).toBeGreaterThan(cardSortRank(cards[0]!.view));
  });
});

describe("cardNetwork", () => {
  it("reads the network from the card's names", () => {
    expect(cardNetwork("TD First Class Travel Visa Infinite", "TD Visa")).toBe("visa");
    expect(cardNetwork(null, "World Elite Mastercard")).toBe("mastercard");
    expect(cardNetwork("Cobalt Card", null, "American Express")).toBe("amex");
    expect(cardNetwork("AMEX GOLD", null)).toBe("amex");
  });
  it("never guesses", () => {
    expect(cardNetwork("Desjardins Card", "Credit")).toBeNull();
    expect(cardNetwork("Visa or Mastercard", null)).toBeNull();
    expect(cardNetwork("Mcdonalds Rewards", null)).toBeNull();
  });
});

describe("isDarkBrandColor", () => {
  it("tells whether white marks read on the bank's color", () => {
    expect(isDarkBrandColor("#006FCF")).toBe(true);
    expect(isDarkBrandColor("#FFD200")).toBe(false);
    expect(isDarkBrandColor(null)).toBe(false);
  });
});
