/**
 * Canned institutions/accounts for MOCK_MODE (lib/config.ts). Lets the app
 * run and demo fully — Accounts, Overview, balances — without any Plaid
 * credentials. Distinct from WORK.md §13's Sandbox fixtures (recorded real
 * Plaid responses used in tests); this is a standalone dev-only data source.
 */

export interface MockAccount {
  name: string;
  officialName: string;
  mask: string;
  type: "depository" | "credit" | "investment";
  subtype: string;
  currentBalance: number; // cents
  availableBalance: number | null;
  creditLimit: number | null;
}

export interface MockInstitution {
  id: string; // stable slug, prefixed mock- when stored
  name: string;
  primaryColor: string;
  accounts: MockAccount[];
}

export const MOCK_INSTITUTIONS: MockInstitution[] = [
  {
    id: "ridgeline-federal",
    name: "Ridgeline Federal",
    primaryColor: "#14513F",
    accounts: [
      {
        name: "Everyday Checking",
        officialName: "Ridgeline Federal Total Checking",
        mask: "4021",
        type: "depository",
        subtype: "checking",
        currentBalance: 482_016,
        availableBalance: 471_016,
        creditLimit: null,
      },
      {
        name: "High-Yield Savings",
        officialName: "Ridgeline Federal Savings Plus",
        mask: "8890",
        type: "depository",
        subtype: "savings",
        currentBalance: 1_842_355,
        availableBalance: 1_842_355,
        creditLimit: null,
      },
      {
        name: "Signature Card",
        officialName: "Ridgeline Federal Signature Rewards",
        mask: "2217",
        type: "credit",
        subtype: "credit card",
        // Plaid convention: a credit account's current balance is positive
        // (amount owed) — matches how /accounts/get returns real cards, and
        // how the Overview/Accounts net-worth math (assets − liabilities)
        // treats it. A negative value here would inflate net worth instead
        // of reducing it.
        currentBalance: 134_582,
        availableBalance: 865_418,
        creditLimit: 1_000_000,
      },
    ],
  },
  {
    id: "meridian-investments",
    name: "Meridian Investments",
    primaryColor: "#4A3AA7",
    accounts: [
      {
        name: "Brokerage",
        officialName: "Meridian Individual Brokerage",
        mask: "5541",
        type: "investment",
        subtype: "brokerage",
        currentBalance: 21_842_930,
        availableBalance: null,
        creditLimit: null,
      },
      {
        name: "Roth IRA",
        officialName: "Meridian Roth IRA",
        mask: "9013",
        type: "investment",
        subtype: "roth",
        currentBalance: 6_412_070,
        availableBalance: null,
        creditLimit: null,
      },
    ],
  },
  {
    id: "harbor-credit-union",
    name: "Harbor Credit Union",
    primaryColor: "#2A78D6",
    accounts: [
      {
        name: "Joint Checking",
        officialName: "Harbor Credit Union Joint Checking",
        mask: "3350",
        type: "depository",
        subtype: "checking",
        currentBalance: 156_204,
        availableBalance: 156_204,
        creditLimit: null,
      },
    ],
  },
];
