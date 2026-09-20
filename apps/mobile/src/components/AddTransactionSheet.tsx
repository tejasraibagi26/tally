import { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import { X, ChevronRight, Calendar } from "lucide-react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useAccounts } from "@/lib/queries/accounts";
import { useCategories } from "@/lib/queries/categories";
import { useCreateTransaction } from "@/lib/queries/transactions";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { Sheet } from "@/components/ui/Sheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// Local calendar-day components, not toISOString() -- that converts to UTC
// and would silently roll the date back a day for anyone west of UTC
// picking "today" in the evening. postedDate is a plain SQL date with no
// time component, so it must be built from the picker's local Y/M/D.
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// For a purchase Plaid never saw -- cash, an account this app isn't linked
// to, or just something the user wants tracked right away. Mirrors web's
// AddTransactionForm.tsx: same POST /api/transactions contract, same
// isManual row it creates (editable/deletable from the detail screen after).
export function AddTransactionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createTransaction = useCreateTransaction();
  const allAccounts = [...(accountsData?.institutions.flatMap((i) => i.accounts) ?? []), ...(accountsData?.unlinkedAccounts ?? [])];

  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = allAccounts.find((a) => a.id === accountId) ?? allAccounts[0];
  const category = categoriesData?.categories.find((c) => c.id === categoryId);

  function reset() {
    setKind("expense");
    setName("");
    setAmountInput("");
    setAccountId(null);
    setCategoryId(null);
    setDate(new Date());
    setShowIOSPicker(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Android shows its own native dialog imperatively and fires exactly one
  // change event when dismissed; iOS has no equivalent modal mode for
  // "inline" (compact/wheels open a picker view of their own), so it's
  // toggled open in-place instead. Same DateTimePicker component either way.
  function openDatePicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        mode: "date",
        display: "default",
        onChange: (event, selected) => {
          if (event.type === "set" && selected) setDate(selected);
        },
      });
    } else {
      setShowIOSPicker((v) => !v);
    }
  }

  async function submit() {
    const amount = Math.round(parseFloat(amountInput) * 100);
    const account = selectedAccount;
    if (!name.trim() || !account || !Number.isFinite(amount) || amount <= 0) {
      setError("Fill in a description, amount, and account.");
      return;
    }
    setError(null);
    try {
      await createTransaction.mutateAsync({ accountId: account.id, postedDate: toDateString(date), name: name.trim(), amount, kind, categoryId });
      handleClose();
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="90%">
      {/* Keyboard avoidance now lives in Sheet.tsx itself, around the sheet's outer
          positioning -- a KeyboardAvoidingView here, nested inside the already-positioned
          sheet, couldn't move it above the keyboard. */}
      <>
        <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Add transaction</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <X size={22} color={colors["text-2"]} />
          </Pressable>
        </View>

        <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row rounded-control overflow-hidden" style={{ borderWidth: 1, borderColor: colors["border-strong"], height: 44 }}>
            <Pressable
              onPress={() => setKind("expense")}
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: kind === "expense" ? colors["negative-subtle"] : colors.surface }}
            >
              <Text className="font-ui-semibold" style={{ fontSize: rf(14), color: kind === "expense" ? colors.negative : colors["text-2"] }}>Expense</Text>
            </Pressable>
            <Pressable
              onPress={() => setKind("income")}
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: kind === "income" ? colors["positive-subtle"] : colors.surface }}
            >
              <Text className="font-ui-semibold" style={{ fontSize: rf(14), color: kind === "income" ? colors.positive : colors["text-2"] }}>Income</Text>
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Description"
            placeholderTextColor={colors["text-3"]}
            className="rounded-control bg-surface-2 px-[14px] font-ui text-text"
            style={{ height: 46, fontSize: rf(14.5) }}
          />

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

          <Pressable
            onPress={openDatePicker}
            className="flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]"
            style={{ height: 46 }}
          >
            <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>{formatDisplayDate(date)}</Text>
            <Calendar size={16} color={colors["text-3"]} />
          </Pressable>

          {Platform.OS === "ios" && showIOSPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              themeVariant={colorScheme === "dark" ? "dark" : "light"}
              accentColor={colors.brand}
              onChange={(_, selected) => {
                if (selected) setDate(selected);
              }}
            />
          )}

          <Pressable
            onPress={() => setPickerOpen(true)}
            className="flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]"
            style={{ height: 46 }}
          >
            <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }}>{category?.name ?? "Uncategorized"}</Text>
            <ChevronRight size={16} color={colors["text-3"]} />
          </Pressable>

          {allAccounts.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {allAccounts.map((a) => {
                const selected = (accountId ?? allAccounts[0]?.id) === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAccountId(a.id)}
                    className="px-4 py-2.5 rounded-full"
                    style={{ backgroundColor: selected ? colors.brand : colors["surface-2"] }}
                  >
                    <Text className="font-ui-medium" style={{ fontSize: rf(13.5), color: selected ? colors["on-brand"] : colors.text }}>
                      {a.name}{a.mask ? ` ····${a.mask}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
        </ScrollView>

        <View className="px-5 pt-3" style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={submit}
            disabled={createTransaction.isPending}
            className="rounded-full bg-brand items-center justify-center active:opacity-90 disabled:opacity-50"
            style={{ height: 52 }}
          >
            {createTransaction.isPending ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>Add transaction</Text>
            )}
          </Pressable>
        </View>
      </>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} selectedId={categoryId} onSelect={setCategoryId} />
    </Sheet>
  );
}
