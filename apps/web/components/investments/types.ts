import type { HoldingInput, TxnInput } from "@tally/core/investments";
import type { ConnectionBadge } from "@tally/core/connectionState";

// Plain, serializable shapes the server Investments page hands its client view.

export interface HoldingView extends HoldingInput {
  /** Cents per share, display currency. */
  institutionPrice: number | null;
  priceAsOf: string | null;
  itemId: string | null;
  asOfDate: string;
}

export interface ActivityView extends TxnInput {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  accountId: string;
  accountName: string;
  securityId: string | null;
}

/** A bank connection behind one or more investment accounts. */
export interface InvestmentConnection {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  badge: ConnectionBadge;
}
