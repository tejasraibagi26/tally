import { useState } from "react";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { Calendar, ChevronRight, X } from "lucide-react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useAccounts } from "@/lib/queries/accounts";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { Sheet } from "@/components/ui/Sheet";
import { MultiPickerSheet } from "@/components/ui/MultiPickerSheet";

export interface TransactionFilters {
  account?: string[];
  pending?: "1";
  from?: string;
  to?: string;
  /** Not settable from this sheet's own fields -- only ever arrives as an
   * initial deep-link filter from Budgets' "View transactions" (which also
   * always pairs it with transfer=0/excluded=0, matching web's link exactly). */
  category?: string;
}

function lastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 86_400_000);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
  return { from: lastMonthStart.toISOString().slice(0, 10), to: lastMonthEnd.toISOString().slice(0, 10) };
}

function isLastMonthRange(from?: string, to?: string): boolean {
  const lm = lastMonthRange();
  return from === lm.from && to === lm.to;
}

// This-month-so-far -- a sensible starting point once "Custom" is tapped,
// rather than dropping the user into an empty/invalid range.
function defaultCustomRange(): { from: string; to: string } {
  const now = new Date();
  return { from: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateString(now) };
}

// Local calendar-day components, not toISOString() -- same reasoning as
// AddTransactionSheet.tsx's own toDateString: postedDate is a plain SQL
// date, so it must come from the picker's local Y/M/D, not a UTC conversion
// that can roll it back a day for anyone west of UTC.
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateString(s: string | undefined): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d);
}

function formatDisplayDate(s: string): string {
  return parseDateString(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
// range (including an arbitrary custom range, matching web), account
// (multi-select -- app/api/transactions/route.ts accepts a comma-joined
// list), pending-only.
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
  const { colorScheme } = useColorScheme();
  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const [pickingAccounts, setPickingAccounts] = useState(false);
  const [openField, setOpenField] = useState<"from" | "to" | null>(null);
  const { data: accounts } = useAccounts();
  const allAccounts = [...(accounts?.institutions.flatMap((i) => i.accounts) ?? []), ...(accounts?.unlinkedAccounts ?? [])];
  const selectedAccountIds = draft.account ?? [];
  const accountSummary =
    selectedAccountIds.length === 0
      ? "All accounts"
      : selectedAccountIds.length === 1
        ? (() => {
            const a = allAccounts.find((acc) => acc.id === selectedAccountIds[0]);
            return a ? `${a.name}${a.mask ? ` ····${a.mask}` : ""}` : "1 account";
          })()
        : `${selectedAccountIds.length} accounts`;

  const customActive = Boolean(draft.from || draft.to) && !isLastMonthRange(draft.from, draft.to);

  function openDatePicker(field: "from" | "to") {
    const current = field === "from" ? draft.from : draft.to;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: parseDateString(current),
        mode: "date",
        display: "default",
        onChange: (event, selected) => {
          if (event.type === "set" && selected) setDraft((d) => ({ ...d, [field]: toDateString(selected) }));
        },
      });
    } else {
      setOpenField((f) => (f === field ? null : field));
    }
  }

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

        <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text className="font-ui-semibold text-text-2 mb-2.5" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
              Date range
            </Text>
            <View className="flex-row flex-wrap">
              <Chip label="This month" selected={!draft.from && !draft.to} onPress={() => setDraft((d) => ({ ...d, from: undefined, to: undefined }))} colors={colors} />
              <Chip label="Last month" selected={isLastMonthRange(draft.from, draft.to)} onPress={() => setDraft((d) => ({ ...d, ...lastMonthRange() }))} colors={colors} />
              <Chip
                label="Custom"
                selected={customActive}
                onPress={() => {
                  setOpenField(null);
                  if (!customActive) setDraft((d) => ({ ...d, ...defaultCustomRange() }));
                }}
                colors={colors}
              />
            </View>

            {customActive && (
              <View style={{ marginTop: 4 }}>
                <View className="flex-row" style={{ gap: 8 }}>
                  <Pressable onPress={() => openDatePicker("from")} className="flex-1 flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]" style={{ height: 46, borderWidth: 1, borderColor: colors.border }}>
                    <View>
                      <Text className="font-ui text-text-3" style={{ fontSize: rf(10.5) }}>From</Text>
                      <Text className="font-ui text-text" style={{ fontSize: rf(13.5) }}>{draft.from ? formatDisplayDate(draft.from) : "—"}</Text>
                    </View>
                    <Calendar size={15} color={colors["text-3"]} />
                  </Pressable>
                  <Pressable onPress={() => openDatePicker("to")} className="flex-1 flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]" style={{ height: 46, borderWidth: 1, borderColor: colors.border }}>
                    <View>
                      <Text className="font-ui text-text-3" style={{ fontSize: rf(10.5) }}>To</Text>
                      <Text className="font-ui text-text" style={{ fontSize: rf(13.5) }}>{draft.to ? formatDisplayDate(draft.to) : "—"}</Text>
                    </View>
                    <Calendar size={15} color={colors["text-3"]} />
                  </Pressable>
                </View>

                {Platform.OS === "ios" && openField && (
                  <DateTimePicker
                    value={parseDateString(openField === "from" ? draft.from : draft.to)}
                    mode="date"
                    display="inline"
                    themeVariant={colorScheme === "dark" ? "dark" : "light"}
                    accentColor={colors.brand}
                    onChange={(_, selected) => {
                      if (selected) setDraft((d) => ({ ...d, [openField]: toDateString(selected) }));
                    }}
                  />
                )}
              </View>
            )}
          </View>

          <View>
            <Text className="font-ui-semibold text-text-2 mb-2.5" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
              Account
            </Text>
            {/* Chips don't scale here the way they do for Date range/Status --
                those are small fixed sets, but the account list is open-ended
                and someone with several linked accounts would get a wall of
                wrapping chips. Single row opening its own multi-select sheet
                instead, so the full list scrolls there rather than expanding
                this one. */}
            <Pressable
              onPress={() => setPickingAccounts(true)}
              className="flex-row items-center justify-between h-12 rounded-control bg-surface-2 px-[14px]"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }} numberOfLines={1}>
                {accountSummary}
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

      <MultiPickerSheet
        visible={pickingAccounts}
        onClose={() => setPickingAccounts(false)}
        title="Accounts"
        items={allAccounts.map((a) => ({ id: a.id, label: a.name, sublabel: a.mask ? `····${a.mask}` : undefined }))}
        selectedIds={selectedAccountIds}
        onApply={(ids) => setDraft((d) => ({ ...d, account: ids.length > 0 ? ids : undefined }))}
      />
    </Sheet>
  );
}
