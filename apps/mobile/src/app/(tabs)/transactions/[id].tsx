import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, Switch, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { X, ChevronRight, Trash2, Check, SplitSquareVertical } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { prettifyPfc } from "@tally/core/pfc";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransaction, useUpdateTransaction, useDeleteTransaction, useMarkAnnual } from "@/lib/queries/transactions";
import { formatCents } from "@tally/core/money";
import { useCategories } from "@/lib/queries/categories";
import { amountColor } from "@/lib/amountColor";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { withAlpha, hairline, chartSeries } from "@/theme/colors";

// MOBILE_DESIGN.md §5.4 -- the web side panel's mobile equivalent, now with
// the same core edit surface as TransactionDetailPanel.tsx: category,
// notes, reviewed, excluded-from-budget, delete. Tags, splits, and
// "always categorize this merchant" preview are deferred -- a smaller,
// genuinely-useful v1 rather than a 1:1 port of every field.
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const rf = useRF();
  const { data: t, isLoading } = useTransaction(id);
  const { data: categoriesData } = useCategories();
  const updateTransaction = useUpdateTransaction(id ?? "");
  const deleteTransaction = useDeleteTransaction(id ?? "");
  const markAnnual = useMarkAnnual(id ?? "");

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!t) return;
    setCategoryId(t.categoryId);
    setNotes(t.notes ?? "");
    setReviewed(t.reviewed);
    setExcluded(t.excludedFromBudget);
    setDirty(false);
  }, [t]);

  const currentCategory = categoriesData?.categories.find((c) => c.id === categoryId);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function save() {
    await updateTransaction.mutateAsync({ categoryId, notes: notes.trim() || null, reviewed, excluded });
    setDirty(false);
  }

  function confirmDelete() {
    Alert.alert("Delete transaction?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction.mutateAsync();
          router.back();
        },
      },
    ]);
  }

  return (
    // iOS's "modal" (card) presentation already reserves its own space above
    // the content, so adding insets.top on top of that double-counted it (the
    // ~130px dead space above the title this screen used to have) -- a fixed
    // 22px is enough there. Android's "modal" draws edge-to-edge under the
    // status bar instead, so it still needs the real inset (more.tsx's sheet
    // looked like a counterexample, but it's bottom-anchored at 46% height
    // and never reaches the status bar either way -- not actually evidence
    // either platform's full-height modal skips the inset).
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-surface"
      style={{ paddingTop: Platform.OS === "ios" ? 22 : insets.top + 12 }}
    >
      <Stack.Screen options={{ presentation: "modal" }} />
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Transaction</Text>
        <View className="flex-row items-center gap-2">
          {t && (
            <Pressable
              onPress={confirmDelete}
              hitSlop={8}
              className="items-center justify-center rounded-full bg-surface-2"
              style={{ width: 36, height: 36 }}
            >
              <Trash2 size={17} color={colors.negative} strokeWidth={1.9} />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="items-center justify-center rounded-full bg-surface-2"
            style={{ width: 36, height: 36 }}
          >
            <X size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {isLoading || !t ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <>
          <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: dirty ? 24 : insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            <View className="gap-1.5">
              <MoneyText cents={t.amount} signed mask={false} className="font-display" style={{ color: amountColor(t.amount, colors), fontSize: rf(36) }} />
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{t.merchantName ?? t.name}</Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>
                {new Date(t.postedDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
              </Text>
            </View>

            {/* One card instead of a bare hairline-topped list -- matches the
                card-grouping language every other screen (Settings, Overview's
                KPI tiles, the transactions list rows) already uses. */}
            <View className="rounded-card overflow-hidden" style={{ backgroundColor: colors["surface-2"] }}>
              {t.accountName && (
                <CardRow label="Account" value={`${t.accountName}${t.accountMask ? ` ····${t.accountMask}` : ""}`} colors={colors} />
              )}
              <CardRow label="Status" value={t.isPending ? "Pending" : "Posted"} colors={colors} />
              <CardRow label="Original description" value={t.name} mono colors={colors} />
              <View className="flex-row items-center justify-between px-4" style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: hairline(colors) }}>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>Reviewed</Text>
                <Switch value={reviewed} onValueChange={markDirty(setReviewed)} trackColor={{ false: colors["border-strong"], true: colors.brand }} ios_backgroundColor={colors["border-strong"]} />
              </View>
              <View className="flex-row items-center justify-between px-4" style={{ paddingVertical: 13 }}>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>Exclude from budget</Text>
                <Switch value={excluded} onValueChange={markDirty(setExcluded)} trackColor={{ false: colors["border-strong"], true: colors.brand }} ios_backgroundColor={colors["border-strong"]} />
              </View>
            </View>

            {t.amount < 0 &&
              (t.recurringStreamId ? (
                <View className="flex-row items-start gap-2.5 p-3 rounded-control" style={{ backgroundColor: colors["positive-subtle"] }}>
                  <View className="flex-none rounded-full p-1" style={{ backgroundColor: withAlpha(colors.positive, 0.15) }}>
                    <Check size={12} color={colors.positive} strokeWidth={2.5} />
                  </View>
                  <Text className="font-ui-medium flex-1" style={{ fontSize: rf(13), lineHeight: rf(18), color: colors.positive }}>
                    Marked as annual · spread {formatCents(Math.round(Math.abs(t.amount) / 12))}/mo across the budget
                  </Text>
                </View>
              ) : (
                // Solid fill, no dashed border -- the dashed line read as a
                // placeholder/unfinished state, and it contradicted the
                // already-marked version above, which was already solid.
                <Pressable
                  onPress={() => markAnnual.mutate()}
                  disabled={markAnnual.isPending}
                  className="flex-row items-start gap-2.5 p-3 rounded-control disabled:opacity-40"
                  style={{ backgroundColor: colors["brand-subtle"] }}
                >
                  <View className="flex-none rounded-full p-1" style={{ backgroundColor: withAlpha(colors.brand, 0.15) }}>
                    <SplitSquareVertical size={12} color={colors.brand} strokeWidth={2} />
                  </View>
                  <Text className="font-ui-medium text-brand flex-1" style={{ fontSize: rf(13), lineHeight: rf(18) }}>
                    {markAnnual.isPending ? "Marking…" : "Mark as annual subscription · spread cost across 12 months"}
                  </Text>
                </Pressable>
              ))}

            <View className="gap-2">
              <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
                Category
              </Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between h-12 rounded-control bg-surface-2 px-[14px]"
              >
                <View className="flex-row items-center gap-2.5">
                  {/* Same category-color dot CategoryPickerSheet uses while
                      picking -- this screen never carried it through to the
                      already-chosen state. */}
                  {currentCategory && (
                    <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: series[(currentCategory.colorSlot - 1) % 8] }} />
                  )}
                  <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>{currentCategory?.name ?? (categoryId ? prettifyPfc(t.pfcDetailed) : "Uncategorized")}</Text>
                </View>
                <ChevronRight size={16} color={colors["text-3"]} />
              </Pressable>
            </View>

            <View className="gap-2">
              <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
                Note
              </Text>
              <TextInput
                value={notes}
                onChangeText={markDirty(setNotes)}
                placeholder="Add a note…"
                placeholderTextColor={colors["text-3"]}
                multiline
                numberOfLines={3}
                className="rounded-control bg-surface-2 px-[14px] py-3 font-ui text-text"
                style={{ minHeight: 72, textAlignVertical: "top", fontSize: rf(14) }}
              />
            </View>

            {t.splits.length > 0 && (
              <View className="gap-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
                  Split
                </Text>
                {t.splits.map((s, i) => (
                  <View key={i} className="flex-row justify-between">
                    <Text className="font-ui text-text" style={{ fontSize: rf(14) }}>{s.note ?? "Split"}</Text>
                    <MoneyText cents={s.amount} mask={false} className="text-text" style={{ fontSize: rf(14) }} />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {dirty && (
            <View className="px-5 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }}>
              <Pressable
                onPress={save}
                disabled={updateTransaction.isPending}
                className="rounded-full bg-brand flex-row items-center justify-center gap-2 active:opacity-90 disabled:opacity-50"
                style={{ height: 52 }}
              >
                {updateTransaction.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={17} color="#FFFFFF" strokeWidth={2.5} />
                    <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>Save changes</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} selectedId={categoryId} onSelect={markDirty(setCategoryId)} />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function CardRow({ label, value, mono, colors }: { label: string; value: string; mono?: boolean; colors: ReturnType<typeof useThemeColors> }) {
  const rf = useRF();
  return (
    <View className="flex-row justify-between px-4" style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: hairline(colors) }}>
      <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>{label}</Text>
      <Text className="font-ui text-text" style={mono ? { fontFamily: "JetBrainsMono", fontSize: 12.5, color: colors["text-2"], textTransform: "uppercase" } : { fontSize: rf(14) }}>
        {value}
      </Text>
    </View>
  );
}
