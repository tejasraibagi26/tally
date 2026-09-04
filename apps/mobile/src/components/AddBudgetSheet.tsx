import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, Switch, ActivityIndicator } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useCategories } from "@/lib/queries/categories";
import { useSaveBudget } from "@/lib/queries/budgets";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { Sheet } from "@/components/ui/Sheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// Mirrors web's AddBudgetForm.tsx: pick a not-yet-budgeted expense category,
// set an amount, optionally roll over unused and/or mark it a fixed charge
// (skips the burn-rate projection, which assumes spend accrues gradually
// through the month -- doesn't apply to something like rent or insurance).
export function AddBudgetSheet({
  visible,
  onClose,
  month,
  budgetedCategoryIds,
}: {
  visible: boolean;
  onClose: () => void;
  month: string;
  budgetedCategoryIds: string[];
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const { data: categoriesData } = useCategories();
  const saveBudget = useSaveBudget();

  const availableCategories = useMemo(() => {
    const budgeted = new Set(budgetedCategoryIds);
    return (categoriesData?.categories ?? []).filter((c) => c.kind === "expense" && !budgeted.has(c.id));
  }, [categoriesData, budgetedCategoryIds]);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [rollover, setRollover] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = availableCategories.find((c) => c.id === categoryId);

  function reset() {
    setCategoryId(null);
    setAmountInput("");
    setRollover(false);
    setFixed(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit() {
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!categoryId || !Number.isFinite(amount) || amount < 0) {
      setError("Choose a category and an amount.");
      return;
    }
    setError(null);
    try {
      await saveBudget.mutateAsync({ month, categoryId, amount, rolloverEnabled: rollover, isFixedAmount: fixed });
      handleClose();
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="80%">
      <>
        <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Add budget</Text>
        </View>

        <View className="px-5 gap-4" style={{ paddingBottom: 8 }}>
          {availableCategories.length === 0 ? (
            <Text className="font-ui text-text-3" style={{ fontSize: rf(14) }}>
              Every expense category already has a budget this month.
            </Text>
          ) : (
            <>
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]"
                style={{ height: 46 }}
              >
                <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>{category?.name ?? "Choose category"}</Text>
                <ChevronRight size={16} color={colors["text-3"]} />
              </Pressable>

              <View className="flex-row items-center rounded-control bg-surface-2 px-[14px]" style={{ height: 46 }}>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(14.5) }}>$</Text>
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="0.00"
                  placeholderTextColor={colors["text-3"]}
                  keyboardType="decimal-pad"
                  className="flex-1 font-ui text-text px-1.5"
                  style={{ fontSize: rf(14.5) }}
                />
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>Rollover unused</Text>
                <Switch value={rollover} onValueChange={setRollover} trackColor={{ false: colors["border-strong"], true: colors.brand }} ios_backgroundColor={colors["border-strong"]} />
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>Fixed amount</Text>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>
                    A fixed charge like rent or insurance — skips the burn-rate projection, which assumes spend accrues gradually through the month.
                  </Text>
                </View>
                <Switch value={fixed} onValueChange={setFixed} trackColor={{ false: colors["border-strong"], true: colors.brand }} ios_backgroundColor={colors["border-strong"]} />
              </View>

              {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
            </>
          )}
        </View>

        {availableCategories.length > 0 && (
          <View className="px-5 pt-3" style={{ paddingBottom: 24 }}>
            <Pressable
              onPress={submit}
              disabled={saveBudget.isPending}
              className="rounded-full bg-brand items-center justify-center active:opacity-90 disabled:opacity-50"
              style={{ height: 52 }}
            >
              {saveBudget.isPending ? <ActivityIndicator color="#FFFFFF" /> : (
                <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>Add budget</Text>
              )}
            </Pressable>
          </View>
        )}
      </>

      <CategoryPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={categoryId}
        onSelect={(id) => setCategoryId(id)}
        categories={availableCategories}
        includeUncategorized={false}
      />
    </Sheet>
  );
}
