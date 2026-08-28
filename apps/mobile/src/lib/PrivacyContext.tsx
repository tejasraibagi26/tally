import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getStoredHideAmounts, storeHideAmounts } from "@/lib/privacy";

// Matches apps/web/lib/privacy.ts + components/PrivacyToggle.tsx: a single
// app-wide "hide amounts" switch, persisted across launches, that
// MoneyText reads to mask every dollar figure that opts in (the default --
// see MoneyText.tsx's `mask` prop for the Budgets/Subscriptions opt-out,
// mirroring web's .money-class scoping).
const PrivacyContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    getStoredHideAmounts().then(setHidden);
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      storeHideAmounts(next);
      return next;
    });
  }, []);

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
