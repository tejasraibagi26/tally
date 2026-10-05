import { useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import { fmtBudget } from "@/components/budgets/BudgetRowItem";
import { useBudgetHistory, useDeleteBudget, useSaveBudget, type BudgetLine } from "@/lib/queries/budgets";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * One budget: this month, six months of history (with the average, to pick
 * a realistic amount), plain-language toggles, Save, See transactions, and
 * Remove -- which hands an undo back to the screen's toast.
 */
export function BudgetDetailSheet({
  line,
  month,
  color,
  onClose,
  onViewTransactions,
  onRemoved,
}: {
  line: BudgetLine;
  month: string;
  color: string;
  onClose: () => void;
  onViewTransactions: () => void;
  onRemoved: (undo: () => void) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const history = useBudgetHistory(line.categoryId, month);
  const save = useSaveBudget();
  const del = useDeleteBudget();
  const [amountInput, setAmountInput] = useState((line.amount / 100).toFixed(0));
  const [rollover, setRollover] = useState(line.rolloverEnabled);
  const [fixed, setFixed] = useState(line.isFixedAmount);
  const [error, setError] = useState<string | null>(null);

  const amount = Math.round((parseFloat(amountInput) || 0) * 100);
  const dirty = amount !== line.amount || rollover !== line.rolloverEnabled || fixed !== line.isFixedAmount;
  const months = history.data?.months ?? [];
  const past = months.slice(0, -1).filter((h) => h.spend > 0 || h.amount != null);
  const recent = past.slice(-3);
  const avg = recent.length ? Math.round(recent.reduce((s, h) => s + h.spend, 0) / recent.length) : null;
  const overCount = past.filter((h) => h.amount != null && h.spend > h.amount).length;
  const maxBar = Math.max(1, ...months.map((h) => Math.max(h.spend, h.amount ?? 0)));
  const label = { fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" as const };

  function onSave() {
    setError(null);
    save.mutate({ month, categoryId: line.categoryId, amount, rolloverEnabled: rollover, isFixedAmount: fixed }, { onSuccess: onClose, onError: () => setError("Couldn't save. Try again.") });
  }

  function onRemove() {
    const snapshot = { month, categoryId: line.categoryId, amount: line.amount, rolloverEnabled: line.rolloverEnabled, isFixedAmount: line.isFixedAmount };
    del.mutate(
      { month, categoryId: line.categoryId },
      {
        onSuccess: () => onRemoved(() => save.mutate(snapshot)),
        onError: () => setError("Couldn't remove. Try again."),
      },
    );
  }

  return (
    <Sheet visible onClose={onClose} maxHeight="88%">
      <View className="px-5 pt-1 pb-3 gap-4">
        <View className="flex-row items-center gap-2.5">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <Text className="font-ui-semibold text-text flex-1" style={{ fontSize: rf(17) }} numberOfLines={1}>{line.categoryName}</Text>
        </View>
        <View className="flex-row justify-between">
          <View className="gap-0.5">
            <Text className="font-ui-medium text-text-3" style={label}>Spent</Text>
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(22), fontVariant: ["tabular-nums"] }}>{fmtBudget(line.spend)}</Text>
          </View>
          <View className="gap-0.5 items-end">
            <Text className="font-ui-medium text-text-3" style={label}>Budget</Text>
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(22), fontVariant: ["tabular-nums"] }}>{fmtBudget(line.amount + line.rolloverFromPrior)}</Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-ui-semibold text-text-3" style={label}>Last 6 months</Text>
          {history.isLoading ? (
            <View className="h-[80px] rounded-control bg-sunken" />
          ) : (
            <View className="flex-row items-end gap-2" style={{ height: 80 }}>
              {months.map((h) => {
                const over = h.amount != null && h.spend > h.amount;
                return (
                  <View key={h.month} className="flex-1 items-center justify-end gap-1" style={{ height: 80 }}>
                    <View style={{ width: "100%", height: Math.max(2, (h.spend / maxBar) * 58), borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: over ? colors.negative : color }} />
                    <Text className="font-ui text-text-3" style={{ fontSize: rf(10) }}>{new Date(`${h.month}T00:00:00`).toLocaleDateString(undefined, { month: "short" })}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {avg != null && (
            <View className="flex-row flex-wrap items-center">
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>
                {recent.length}-month average {fmtBudget(avg)}
                {overCount > 0 ? ` · over budget ${overCount === 1 ? "once" : `${overCount} times`}` : ""}
              </Text>
              {Math.abs(avg - amount) >= 1000 && (
                <Pressable onPress={() => setAmountInput(String(Math.ceil(avg / 1000) * 10))} hitSlop={6}>
                  <Text className="font-ui-medium text-brand" style={{ fontSize: rf(12) }}> · Use {fmtBudget(Math.ceil(avg / 1000) * 1000)}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View className="gap-1.5">
          <Text className="font-ui-medium text-text-3" style={label}>Monthly budget</Text>
          <View className="flex-row items-center h-12 rounded-control bg-surface-2 px-3">
            <Text className="font-ui text-text-3 mr-1" style={{ fontSize: rf(14) }}>$</Text>
            <TextInput value={amountInput} onChangeText={setAmountInput} keyboardType="number-pad" className="flex-1 font-ui text-text" style={{ fontSize: rf(15), paddingVertical: 0 }} />
          </View>
        </View>

        <View className="rounded-control bg-sunken px-4">
          <ToggleRow label="Roll over what's left" hint="Unspent money adds to next month's budget." value={rollover} onChange={setRollover} />
          <ToggleRow label="Fixed amount" hint="For rent or insurance: paid / not paid, no pace." value={fixed} onChange={setFixed} border />
        </View>

        {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
        <View className="flex-row gap-2">
          <Pressable onPress={onSave} disabled={!dirty || save.isPending} className="flex-1 h-11 rounded-full items-center justify-center bg-brand" style={{ opacity: !dirty ? 0.4 : 1 }}>
            {save.isPending ? <ActivityIndicator color={colors["on-brand"]} /> : <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Save</Text>}
          </Pressable>
          <Pressable onPress={onViewTransactions} className="flex-1 h-11 rounded-full items-center justify-center bg-brand-subtle">
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>See transactions</Text>
          </Pressable>
        </View>
        <Pressable onPress={onRemove} disabled={del.isPending} className="items-center py-2">
          <Text className="font-ui-medium text-negative" style={{ fontSize: rf(13.5) }}>{del.isPending ? "Removing…" : "Remove budget"}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function ToggleRow({ label, hint, value, onChange, border }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; border?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between gap-4 py-3" style={border ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
      <View className="flex-1 gap-0.5">
        <Text className="font-ui text-text" style={{ fontSize: rf(14) }}>{label}</Text>
        <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand, false: colors["surface-2"] }} accessibilityLabel={label} />
    </View>
  );
}
