import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, Switch, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { X, ChevronRight, Trash2, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { prettifyPfc } from "@tally/core/pfc";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransaction, useUpdateTransaction, useDeleteTransaction } from "@/lib/queries/transactions";
import { useCategories } from "@/lib/queries/categories";
import { amountColor } from "@/lib/amountColor";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

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
  const rf = useRF();
  const { data: t, isLoading } = useTransaction(id);
  const { data: categoriesData } = useCategories();
  const updateTransaction = useUpdateTransaction(id ?? "");
  const deleteTransaction = useDeleteTransaction(id ?? "");

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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
      <Stack.Screen options={{ presentation: "modal" }} />
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Transaction</Text>
        <View className="flex-row items-center gap-4">
          {t && (
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <Trash2 size={20} color={colors.negative} />
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <X size={22} color={colors["text-2"]} />
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

            <View className="gap-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              {t.accountName && <DetailRow label="Account" value={`${t.accountName}${t.accountMask ? ` ····${t.accountMask}` : ""}`} />}
              <DetailRow label="Status" value={t.isPending ? "Pending" : "Posted"} />
              <DetailRow label="Original description" value={t.name} mono />
              <View className="flex-row items-center justify-between">
                <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>Reviewed</Text>
                <Switch value={reviewed} onValueChange={markDirty(setReviewed)} trackColor={{ true: colors.brand }} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>Exclude from budget</Text>
                <Switch value={excluded} onValueChange={markDirty(setExcluded)} trackColor={{ true: colors.brand }} />
              </View>
            </View>

            <View className="gap-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
                Category
              </Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between h-12 rounded-control bg-surface-2 px-[14px]"
              >
                <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>{currentCategory?.name ?? (categoryId ? prettifyPfc(t.pfcDetailed) : "Uncategorized")}</Text>
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

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const rf = useRF();
  return (
    <View className="flex-row justify-between">
      <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>{label}</Text>
      <Text className="font-ui text-text" style={mono ? { fontFamily: "JetBrainsMono", fontSize: 12.5 } : { fontSize: rf(14) }}>
        {value}
      </Text>
    </View>
  );
}
