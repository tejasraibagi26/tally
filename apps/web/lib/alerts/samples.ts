import type { AlertCandidate, AlertType } from "@tally/core/alerts";

/** Example content for Settings → "Send a test alert", one per type. Clearly marked as a test. */
export const SAMPLE_ALERTS: Record<AlertType, AlertCandidate> = {
  budget_threshold: {
    type: "budget_threshold",
    dedupeKey: "",
    title: "Test: Dining is at 82%",
    body: "$412.00 of $500.00 spent, 11 days left.",
    titleNoAmounts: "Test: Dining is at 82%",
    bodyNoAmounts: "82% of this month's budget, 11 days left.",
    url: "/budgets",
  },
  connection_broken: {
    type: "connection_broken",
    dedupeKey: "",
    title: "Test: TD Canada Trust needs you to sign in again",
    body: "Syncing is paused until you reconnect.",
    titleNoAmounts: "Test: TD Canada Trust needs you to sign in again",
    bodyNoAmounts: "Syncing is paused until you reconnect.",
    url: "/accounts",
  },
  large_transaction: {
    type: "large_transaction",
    dedupeKey: "",
    title: "Test: $842.10 at Best Buy",
    body: "Amex Cobalt ····1004",
    titleNoAmounts: "Test: Large purchase at Best Buy",
    bodyNoAmounts: "Amex Cobalt ····1004",
    url: "/transactions",
  },
  subscription_change: {
    type: "subscription_change",
    dedupeKey: "",
    title: "Test: Spotify went up",
    body: "$11.99 → $13.99 a month.",
    titleNoAmounts: "Test: Spotify went up",
    bodyNoAmounts: "The latest charge was higher than the one before.",
    url: "/subscriptions",
  },
};
