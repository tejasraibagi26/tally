import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ChevronRight, X } from "lucide-react-native";
import { useAccounts } from "@/lib/queries/accounts";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { Sheet } from "@/components/ui/Sheet";
import { SimplePickerSheet } from "@/components/ui/SimplePickerSheet";

export interface TransactionFilters {
  account?: string;
  pending?: "1";
  from?: string;
  to?: string;
}

const ALL_ACCOUNTS = "__all__";

function lastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 86_400_000);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
  return { from: lastMonthStart.toISOString().slice(0, 10), to: lastMonthEnd.toISOString().slice(0, 10) };
}

function Chip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: ReturnType<typeof useThemeColors> }) {
  const rf = useRF();
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selected ? "bg-brand" : "bg-surface-2"}`}
      style={!selected ? { borderWidth: 1, borderColor: colors.border } : undefined}
    >
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
  const [pickingAccount, setPickingAccount] = useState(false);
  const { data: accounts } = useAccounts();
  const allAccounts = [...(accounts?.institutions.flatMap((i) => i.accounts) ?? []), ...(accounts?.unlinkedAccounts ?? [])];
  const selectedAccount = allAccounts.find((a) => a.id === draft.account);

  const isLastMonth = (() => {
    const lm = lastMonthRange();
    return draft.from === lm.from && draft.to === lm.to;
  })();

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="85%">
      <View>
        <View className="flex-row items-center justify-between px-5 pt-1 pb-4">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Filters</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            className="items-center justify-center rounded-full bg-surface-2"
            style={{ width: 36, height: 36 }}
          >
            <X size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: 12 }}>
          <View>
            <Text className="font-ui-semibold text-text-2 mb-2.5" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
              Date range
            </Text>
            <View className="flex-row flex-wrap">
              <Chip label="This month" selected={!draft.from && !draft.to} onPress={() => setDraft((d) => ({ ...d, from: undefined, to: undefined }))} colors={colors} />
              <Chip label="Last month" selected={isLastMonth} onPress={() => setDraft((d) => ({ ...d, ...lastMonthRange() }))} colors={colors} />
            </View>
          </View>

          <View>
            <Text className="font-ui-semibold text-text-2 mb-2.5" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
              Account
            </Text>
            {/* Chips don't scale here the way they do for Date range/Status --
                those are small fixed sets, but the account list is open-ended
                and someone with several linked accounts would get a wall of
                wrapping chips. Single-select picker row instead, same pattern
                SimplePickerSheet already uses for account choice elsewhere
                (income schedules, add-transaction) -- the full list scrolls
                inside its own sheet instead of expanding this one. */}
            <Pressable
              onPress={() => setPickingAccount(true)}
              className="flex-row items-center justify-between h-12 rounded-control bg-surface-2 px-[14px]"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>
                {selectedAccount ? `${selectedAccount.name}${selectedAccount.mask ? ` ····${selectedAccount.mask}` : ""}` : "All accounts"}
              </Text>
              <ChevronRight size={16} color={colors["text-3"]} />
            </Pressable>
          </View>

          <View>
            <Text className="font-ui-semibold text-text-2 mb-2.5" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
              Status
            </Text>
            <View className="flex-row flex-wrap">
              <Chip label="All" selected={!draft.pending} onPress={() => setDraft((d) => ({ ...d, pending: undefined }))} colors={colors} />
              <Chip label="Pending only" selected={draft.pending === "1"} onPress={() => setDraft((d) => ({ ...d, pending: "1" }))} colors={colors} />
            </View>
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

      <SimplePickerSheet
        visible={pickingAccount}
        onClose={() => setPickingAccount(false)}
        title="Account"
        items={[{ id: ALL_ACCOUNTS, label: "All accounts" }, ...allAccounts.map((a) => ({ id: a.id, label: a.name, sublabel: a.mask ? `····${a.mask}` : undefined }))]}
        selectedId={draft.account ?? ALL_ACCOUNTS}
        onSelect={(id) => setDraft((d) => ({ ...d, account: id === ALL_ACCOUNTS ? undefined : id }))}
      />
    </Sheet>
  );
}
