import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, Switch, ActivityIndicator, Alert } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useCategories } from "@/lib/queries/categories";
import { useSaveBudget, useDeleteBudget, type BudgetLine } from "@/lib/queries/budgets";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { Sheet } from "@/components/ui/Sheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// Mirrors web's AddBudgetForm.tsx for creating a budget, and BudgetRow.tsx's
// inline edit mode for changing one -- same sheet, same fields, either way.
// Pass `existing` to open in edit mode: the category is locked (matches
// web, which doesn't let you re-point a budget at a different category
// either), fields prefill from it, and "View transactions"/"Remove budget"
// appear. Give this instance a `key` tied to the budget being edited (its
// categoryId) so React remounts it fresh per row -- its state only
// initializes once per mount, and a different row tapped while the same
// component instance is still around would otherwise keep showing the
// previous row's values.
export function AddBudgetSheet({
  visible,
  onClose,
  month,
  budgetedCategoryIds,
  existing,
  onViewTransactions,
}: {
  visible: boolean;
  onClose: () => void;
  month: string;
  budgetedCategoryIds: string[];
  existing?: BudgetLine;
  onViewTransactions?: () => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const { data: categoriesData } = useCategories();
  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const availableCategories = useMemo(() => {
    const budgeted = new Set(budgetedCategoryIds);
    return (categoriesData?.categories ?? []).filter((c) => c.kind === "expense" && !budgeted.has(c.id));
  }, [categoriesData, budgetedCategoryIds]);

  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [categoryName, setCategoryName] = useState<string | null>(existing?.categoryName ?? null);
  const [amountInput, setAmountInput] = useState(existing ? (existing.amount / 100).toFixed(2) : "");
  const [rollover, setRollover] = useState(existing?.rolloverEnabled ?? false);
  const [fixed, setFixed] = useState(existing?.isFixedAmount ?? false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategoryId(existing?.categoryId ?? null);
    setCategoryName(existing?.categoryName ?? null);
    setAmountInput(existing ? (existing.amount / 100).toFixed(2) : "");
    setRollover(existing?.rolloverEnabled ?? false);
    setFixed(existing?.isFixedAmount ?? false);
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

  function remove() {
    if (!existing) return;
    Alert.alert(`Remove the ${existing.categoryName} budget?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBudget.mutateAsync({ month, categoryId: existing.categoryId });
            handleClose();
          } catch {
            setError("Something went wrong. Try again.");
          }
        },
      },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="80%">
      <>
        <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>{existing ? existing.categoryName : "Add budget"}</Text>
        </View>

        <View className="px-5 gap-4" style={{ paddingBottom: 8 }}>
          {!existing && (
            <>
              {availableCategories.length === 0 && (
                <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>
                  Every expense category already has a budget this month. Add a new one below.
                </Text>
              )}
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]"
                style={{ height: 46 }}
              >
                <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>{categoryName ?? "Choose category"}</Text>
                <ChevronRight size={16} color={colors["text-3"]} />
              </Pressable>
            </>
          )}

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
                A fixed charge like rent or insurance. Skips the burn-rate projection, which assumes spend accrues gradually through the month.
              </Text>
            </View>
            <Switch value={fixed} onValueChange={setFixed} trackColor={{ false: colors["border-strong"], true: colors.brand }} ios_backgroundColor={colors["border-strong"]} />
          </View>

          {existing && (
            <>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              {onViewTransactions && (
                <Pressable
                  onPress={() => {
                    onViewTransactions();
                    handleClose();
                  }}
                  className="flex-row items-center justify-between"
                  style={{ paddingVertical: 4 }}
                >
                  <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>View transactions</Text>
                  <ChevronRight size={16} color={colors["text-3"]} />
                </Pressable>
              )}
              <Pressable onPress={remove} disabled={deleteBudget.isPending} style={{ paddingVertical: 4 }}>
                <Text className="font-ui-medium text-negative" style={{ fontSize: rf(14) }}>
                  {deleteBudget.isPending ? "Removing…" : "Remove budget"}
                </Text>
              </Pressable>
            </>
          )}

          {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
        </View>

        <View className="px-5 pt-3" style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={submit}
            disabled={saveBudget.isPending}
            className="rounded-full bg-brand items-center justify-center active:opacity-90 disabled:opacity-50"
            style={{ height: 52 }}
          >
            {saveBudget.isPending ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>{existing ? "Save changes" : "Add budget"}</Text>
            )}
          </Pressable>
        </View>
      </>

      {!existing && (
        <CategoryPickerSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          selectedId={categoryId}
          onSelect={(id, name) => { setCategoryId(id); setCategoryName(name ?? null); }}
          categories={availableCategories}
          includeUncategorized={false}
          allowCreate
        />
      )}
    </Sheet>
  );
}
