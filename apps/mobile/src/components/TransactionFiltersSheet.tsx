import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { useAccounts } from "@/lib/queries/accounts";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { Sheet } from "@/components/ui/Sheet";

export interface TransactionFilters {
  account?: string;
  pending?: "1";
  from?: string;
  to?: string;
}

function lastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 86_400_000);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
  return { from: lastMonthStart.toISOString().slice(0, 10), to: lastMonthEnd.toISOString().slice(0, 10) };
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const rf = useRF();
  return (
    <Pressable onPress={onPress} className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selected ? "bg-brand" : "bg-surface-2"}`}>
      <Text className={`font-ui-medium ${selected ? "text-on-brand" : "text-text"}`} style={{ fontSize: rf(13.5) }}>{label}</Text>
    </Pressable>
  );
}

// Bottom-sheet-style filter modal for Transactions -- MOBILE_DESIGN.md §5.3's
// "filter bottom sheet," built on the shared Sheet shell (ui/Sheet.tsx).
// Covers the same fields GET /api/transactions already supports: date
// range, account, pending-only.
export function TransactionFiltersSheet({
  visible,
  onClose,
  filters,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const { data: accounts } = useAccounts();
  const allAccounts = [...(accounts?.institutions.flatMap((i) => i.accounts) ?? []), ...(accounts?.unlinkedAccounts ?? [])];

  const isLastMonth = (() => {
    const lm = lastMonthRange();
    return draft.from === lm.from && draft.to === lm.to;
  })();

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="85%">
      <View>
        <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Filters</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors["text-2"]} />
          </Pressable>
        </View>

        <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text className="font-ui-semibold text-text-2 mb-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
            Date range
          </Text>
          <View className="flex-row flex-wrap mb-4">
            <Chip label="This month" selected={!draft.from && !draft.to} onPress={() => setDraft((d) => ({ ...d, from: undefined, to: undefined }))} />
            <Chip label="Last month" selected={isLastMonth} onPress={() => setDraft((d) => ({ ...d, ...lastMonthRange() }))} />
          </View>

          <Text className="font-ui-semibold text-text-2 mb-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
            Account
          </Text>
          <View className="flex-row flex-wrap mb-4">
            <Chip label="All accounts" selected={!draft.account} onPress={() => setDraft((d) => ({ ...d, account: undefined }))} />
            {allAccounts.map((a) => (
              <Chip key={a.id} label={a.name} selected={draft.account === a.id} onPress={() => setDraft((d) => ({ ...d, account: a.id }))} />
            ))}
          </View>

          <Text className="font-ui-semibold text-text-2 mb-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
            Status
          </Text>
          <View className="flex-row flex-wrap mb-2">
            <Chip label="All" selected={!draft.pending} onPress={() => setDraft((d) => ({ ...d, pending: undefined }))} />
            <Chip label="Pending only" selected={draft.pending === "1"} onPress={() => setDraft((d) => ({ ...d, pending: "1" }))} />
          </View>
        </ScrollView>

        <View className="px-5 pt-2 pb-8 gap-2.5">
          <Pressable
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            className="h-14 rounded-full bg-brand items-center justify-center active:opacity-90"
          >
            <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>Apply filters</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setDraft({});
              onApply({});
              onClose();
            }}
            className="h-12 items-center justify-center"
          >
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(14) }}>Clear all</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}
