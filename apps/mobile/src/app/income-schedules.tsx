import { useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { Plus } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { SimplePickerSheet } from "@/components/ui/SimplePickerSheet";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { useCategories } from "@/lib/queries/categories";
import { useAccounts } from "@/lib/queries/accounts";
import {
  useIncomeSchedules,
  useCreateIncomeSchedule,
  useUpdateIncomeSchedule,
  useDeleteIncomeSchedule,
  type IncomeSchedule,
} from "@/lib/queries/incomeSchedules";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";

const LAST_DAY = "0";
const NONE = "__none__";

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function anchorLabel(anchor: number): string {
  return anchor === 0 ? "last day of the month" : `the ${ordinal(anchor)}`;
}

const DAY_ITEMS = [{ id: LAST_DAY, label: "Last day of the month" }, ...Array.from({ length: 31 }, (_, i) => ({ id: String(i + 1), label: ordinal(i + 1) }))];

function ScheduleRow({ schedule, isLast }: { schedule: IncomeSchedule; isLast: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const update = useUpdateIncomeSchedule(schedule.id);
  const del = useDeleteIncomeSchedule();

  function confirmDelete() {
    Alert.alert(`Delete "${schedule.label}"?`, "Paychecks it already added stay in your transactions.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate(schedule.id) },
    ]);
  }

  return (
    <View
      className="flex-row items-center gap-3 py-3.5"
      style={!isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
    >
      <View className="flex-1 gap-0.5 min-w-0">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>{schedule.label}</Text>
        <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }} numberOfLines={1}>
          {schedule.accountName ? `${schedule.accountName} ····${schedule.accountMask ?? "----"}` : "—"} ·{" "}
          {schedule.dayAnchors.map(anchorLabel).join(" & ")}
          {schedule.categoryName ? ` · ${schedule.categoryName}` : ""}
        </Text>
      </View>
      <MoneyText cents={schedule.amount} mask={false} className="text-positive font-ui-medium" style={{ fontSize: rf(14.5) }} />
      <Pressable onPress={() => update.mutate({ active: !schedule.active })} disabled={update.isPending} hitSlop={8}>
        <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>{schedule.active ? "Pause" : "Resume"}</Text>
      </Pressable>
      <Pressable onPress={confirmDelete} disabled={del.isPending} hitSlop={8}>
        <Text className="font-ui-medium text-negative" style={{ fontSize: rf(13) }}>Delete</Text>
      </Pressable>
    </View>
  );
}

// Native port of apps/web/components/settings/IncomeScheduleManager.tsx --
// same fields (label, account, amount, up to 2 day-of-month anchors,
// optional income category), same API contract
// (lib/queries/incomeSchedules.ts). Account/day-anchor pickers use the new
// generic SimplePickerSheet (no search needed for either short list);
// category reuses the existing CategoryPickerSheet, pre-filtered to
// kind === "income" the same way web's settings page does server-side.
export default function IncomeSchedulesScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { data, isLoading } = useIncomeSchedules();
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createSchedule = useCreateIncomeSchedule();

  const accounts = useMemo(() => {
    if (!accountsData) return [];
    const fromInstitutions = accountsData.institutions.flatMap((i) => i.accounts);
    return [...fromInstitutions, ...accountsData.unlinkedAccounts];
  }, [accountsData]);
  const incomeCategories = useMemo(() => (categoriesData?.categories ?? []).filter((c) => c.kind === "income"), [categoriesData]);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("Paycheck");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [anchor1, setAnchor1] = useState("15");
  const [anchor2, setAnchor2] = useState<string>(LAST_DAY);
  const [error, setError] = useState<string | null>(null);
  const [pickingAccount, setPickingAccount] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [pickingAnchor, setPickingAnchor] = useState<1 | 2 | null>(null);

  function resetForm() {
    setLabel("Paycheck");
    setAccountId(accounts[0]?.id ?? null);
    setCategoryId(null);
    setAmountInput("");
    setAnchor1("15");
    setAnchor2(LAST_DAY);
    setError(null);
  }

  async function submit() {
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!accountId || !Number.isFinite(amount) || amount <= 0) {
      setError("Choose an account and enter an amount.");
      return;
    }
    const dayAnchors = anchor2 === NONE ? [Number(anchor1)] : [Number(anchor1), Number(anchor2)];
    setError(null);
    try {
      await createSchedule.mutateAsync({ accountId, categoryId, label: label.trim() || "Paycheck", amount, dayAnchors });
      setAdding(false);
      resetForm();
    } catch {
      setError("Something went wrong");
    }
  }

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedCategory = incomeCategories.find((c) => c.id === categoryId);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <>
            {(data?.schedules.length ?? 0) > 0 && (
              <Card className="px-5">
                {data!.schedules.map((s, i, arr) => (
                  <ScheduleRow key={s.id} schedule={s} isLast={i === arr.length - 1} />
                ))}
              </Card>
            )}

            {!adding ? (
              <Pressable
                onPress={() => {
                  resetForm();
                  setAdding(true);
                }}
                className="flex-row items-center justify-center gap-2 h-11 rounded-full bg-surface-2"
              >
                <Plus size={16} color={colors.text} strokeWidth={2} />
                <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Add income schedule</Text>
              </Pressable>
            ) : (
              <Card className="p-5 gap-3">
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="Paycheck"
                  placeholderTextColor={colors["text-3"]}
                  className="h-11 rounded-control bg-surface-2 px-3.5 font-ui text-text"
                  style={{ fontSize: rf(14.5) }}
                />
                <Pressable onPress={() => setPickingAccount(true)} className="h-11 rounded-control bg-surface-2 px-3.5 justify-center">
                  <Text className={selectedAccount ? "font-ui text-text" : "font-ui text-text-3"} style={{ fontSize: rf(14.5) }}>
                    {selectedAccount ? `${selectedAccount.name} ····${selectedAccount.mask ?? "----"}` : "Choose account"}
                  </Text>
                </Pressable>
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="Amount, e.g. 2500.00"
                  placeholderTextColor={colors["text-3"]}
                  keyboardType="decimal-pad"
                  className="h-11 rounded-control bg-surface-2 px-3.5 font-ui text-text tabular"
                  style={{ fontSize: rf(14.5) }}
                />
                <Pressable onPress={() => setPickingCategory(true)} className="h-11 rounded-control bg-surface-2 px-3.5 justify-center">
                  <Text className={selectedCategory ? "font-ui text-text" : "font-ui text-text-3"} style={{ fontSize: rf(14.5) }}>
                    {selectedCategory?.name ?? "Category (optional)"}
                  </Text>
                </Pressable>

                <View className="gap-2">
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>Paid on</Text>
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Pressable onPress={() => setPickingAnchor(1)} className="h-9 px-3 rounded-control bg-surface-2 justify-center">
                      <Text className="font-ui text-text" style={{ fontSize: rf(13.5) }}>{anchorLabel(Number(anchor1))}</Text>
                    </Pressable>
                    {anchor2 !== NONE ? (
                      <>
                        <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>and</Text>
                        <Pressable onPress={() => setPickingAnchor(2)} className="h-9 px-3 rounded-control bg-surface-2 justify-center">
                          <Text className="font-ui text-text" style={{ fontSize: rf(13.5) }}>{anchorLabel(Number(anchor2))}</Text>
                        </Pressable>
                        <Pressable onPress={() => setAnchor2(NONE)} hitSlop={8}>
                          <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>remove</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable onPress={() => setAnchor2(LAST_DAY)} hitSlop={8}>
                        <Text className="font-ui-medium text-brand" style={{ fontSize: rf(13.5) }}>+ add a second payday</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>Moved to the preceding Friday if it lands on a weekend.</Text>
                </View>

                {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}

                <View className="flex-row gap-3 pt-1">
                  <Pressable onPress={() => setAdding(false)} className="flex-1 h-11 rounded-full items-center justify-center bg-surface-2">
                    <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    disabled={createSchedule.isPending}
                    className="flex-1 h-11 rounded-full items-center justify-center bg-brand disabled:opacity-50"
                  >
                    {createSchedule.isPending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Add schedule</Text>
                    )}
                  </Pressable>
                </View>
              </Card>
            )}

            {!isLoading && (data?.schedules.length ?? 0) === 0 && !adding && (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(13.5) }}>
                No income schedules yet — add one for a paycheck Plaid doesn&apos;t reliably catch.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <SimplePickerSheet
        visible={pickingAccount}
        onClose={() => setPickingAccount(false)}
        title="Account"
        items={accounts.map((a) => ({ id: a.id, label: a.name, sublabel: a.mask ? `····${a.mask}` : undefined }))}
        selectedId={accountId}
        onSelect={setAccountId}
      />
      <CategoryPickerSheet
        visible={pickingCategory}
        onClose={() => setPickingCategory(false)}
        selectedId={categoryId}
        onSelect={setCategoryId}
        categories={incomeCategories}
        includeUncategorized={false}
      />
      <SimplePickerSheet
        visible={pickingAnchor !== null}
        onClose={() => setPickingAnchor(null)}
        title="Payday"
        items={DAY_ITEMS}
        selectedId={pickingAnchor === 1 ? anchor1 : anchor2}
        onSelect={(id) => (pickingAnchor === 1 ? setAnchor1(id) : setAnchor2(id))}
      />
    </View>
  );
}
