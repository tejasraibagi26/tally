import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { X, ChevronRight, Calendar, Landmark } from "lucide-react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CURRENCY } from "@tally/core/fx";
import { useAccounts } from "@/lib/queries/accounts";
import { useCategories, useTopCategories, type Category } from "@/lib/queries/categories";
import { useCreateTransaction } from "@/lib/queries/transactions";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { Sheet } from "@/components/ui/Sheet";
import { SimplePickerSheet } from "@/components/ui/SimplePickerSheet";
import { NativeBlur, SHEET_CARD } from "@/components/ui/nativeBlur";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha, chartSeries } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import { PillButton, SheetError } from "@/components/ui/FormSheet";

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

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

const CHIP_COUNT = 5;

/** Digits and one decimal point; at most 7 whole digits and 2 decimals (up to 9,999,999.99). */
function cleanAmount(raw: string): string {
  const t = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole = "", ...rest] = t.split(".");
  const w = whole.slice(0, 7);
  return rest.length ? `${w}.${rest.join("").slice(0, 2)}` : w;
}

type ChipProps = { label: string; selected: boolean; onPress: () => void; dot?: string; accent?: boolean; fill: string };

/** A quick-pick chip: selected wears the ink outline on brand-subtle, like Pop's selected states. */
function Chip({ label, selected, onPress, dot, accent, fill }: ChipProps) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="flex-row items-center rounded-full"
      style={{
        height: 36,
        paddingHorizontal: selected ? 13 : 14,
        gap: 8,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.ink : colors.border,
        backgroundColor: selected ? colors["brand-subtle"] : fill,
      }}
    >
      {dot && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />}
      <Text className={selected || accent ? "font-ui-semibold" : "font-ui-medium"} style={{ fontSize: rf(14), color: accent ? colors.brand : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}


/**
 * For a purchase Plaid never saw -- cash, an account this app isn't linked
 * to, or just something the user wants tracked right away. Same POST
 * /api/transactions contract as web's AddTransactionForm.tsx.
 *
 * Layout is the approved "quick chips" redesign (spec canvas
 * https://claude.ai/artifact/5yBCsdYtpRYBewyW1X5TDa, mobile v2.17.0): the
 * amount is the hero and is focused on open; category and date are one-tap
 * chips; the account is NEVER preselected -- the user must pick it, and the
 * button stays disabled until amount, description and account are all set.
 */
export function AddTransactionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const queryClient = useQueryClient();
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createTransaction = useCreateTransaction();
  const allAccounts = [...(accountsData?.institutions.flatMap((i) => i.accounts) ?? []), ...(accountsData?.unlinkedAccounts ?? [])];

  const [kind, setKind] = useState<"expense" | "income">("expense");
  const { data: topData } = useTopCategories(kind);
  const [name, setName] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [amountWidth, setAmountWidth] = useState(40);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickingAccount, setPickingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Never preselected: the user must choose the account themselves.
  const selectedAccount = allAccounts.find((a) => a.id === accountId);
  const categories = categoriesData?.categories ?? [];
  const category = categories.find((c) => c.id === categoryId);

  // Your most-used categories of this kind (last 90 days), topped up with
  // top-level categories of the same kind while there's little history. A
  // category picked from "All…" joins the row so the selection stays visible.
  const chips = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const picked: Category[] = [];
    for (const id of topData?.categoryIds ?? []) {
      const c = byId.get(id);
      if (c && c.kind === kind) picked.push(c);
    }
    for (const c of categories) {
      if (picked.length >= CHIP_COUNT) break;
      if (c.kind === kind && c.parentId === null && !picked.some((p) => p.id === c.id)) picked.push(c);
    }
    const row = picked.slice(0, CHIP_COUNT);
    if (category && !row.some((c) => c.id === category.id)) row.unshift(category);
    return row;
  }, [categories, topData, kind, category]);

  const series = chartSeries[colorScheme === "dark" ? "dark" : "light"];
  const glassFill = NativeBlur ? withAlpha(colors["surface-2"]!, SHEET_CARD) : colors["surface-2"]!;

  const amountCents = Math.round(parseFloat(amountInput) * 100);
  // 60pt up to 6 characters, then smaller so a long amount still fits a line.
  const amountSize = amountInput.length <= 6 ? 60 : amountInput.length <= 8 ? 48 : 40;
  const amountValid = Number.isFinite(amountCents) && amountCents > 0;
  const canSubmit = amountValid && name.trim().length > 0 && !!selectedAccount;
  const formatted = amountValid ? `$${(amountCents / 100).toFixed(2)}` : null;
  const signColor = !amountInput ? colors["text-3"] : kind === "expense" ? colors.negative : colors.positive;

  const isToday = sameDay(date, new Date());
  const isYesterday = sameDay(date, yesterday());
  const customDate = !isToday && !isYesterday;

  function reset() {
    setKind("expense");
    setName("");
    setAmountInput("");
    setAccountId(null);
    setCategoryId(null);
    setDate(new Date());
    setShowIOSPicker(false);
    setPickingAccount(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function switchKind(next: "expense" | "income") {
    if (next === kind) return;
    setKind(next);
    // An expense category makes no sense on income (and vice versa).
    setCategoryId(null);
  }

  // Android shows its own native dialog imperatively; iOS toggles an inline
  // calendar in place. Same DateTimePicker component either way.
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
    if (!canSubmit || !selectedAccount) return;
    setError(null);
    try {
      await createTransaction.mutateAsync({
        accountId: selectedAccount.id,
        postedDate: toDateString(date),
        name: name.trim(),
        amount: amountCents,
        kind,
        categoryId,
      });
      queryClient.invalidateQueries({ queryKey: ["categories-top"] });
      handleClose();
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  const caption = { fontSize: rf(11), letterSpacing: 0.66, textTransform: "uppercase" as const };

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="92%">
      <View className="flex-row items-center justify-between px-5 pt-1 pb-2">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Add transaction</Text>
        <Pressable
          onPress={handleClose}
          hitSlop={8}
          accessibilityLabel="Close"
          className="items-center justify-center rounded-full"
          style={{ width: 34, height: 34, backgroundColor: glassFill }}
        >
          <X size={16} color={colors.text} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        {/* Kind, then the amount as the hero. */}
        <View className="items-center" style={{ gap: 10 }}>
          <View className="flex-row rounded-full" style={{ padding: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: glassFill }} accessibilityRole="radiogroup">
            {(["expense", "income"] as const).map((k) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => switchKind(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  className="rounded-full items-center justify-center"
                  style={{ height: 32, paddingHorizontal: 16, backgroundColor: on ? colors[k === "expense" ? "negative-subtle" : "positive-subtle"] : "transparent" }}
                >
                  <Text className="font-ui-semibold" style={{ fontSize: rf(13.5), color: on ? colors[k === "expense" ? "negative" : "positive"] : colors["text-2"] }}>
                    {k === "expense" ? "Expense" : "Income"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* The number steps down a size as it grows, and the field is as wide
              as its measured text (a TextInput doesn't size itself) -- so even
              9999999.99 sits on one line instead of clipping. */}
          <View className="flex-row items-center justify-center" style={{ alignSelf: "stretch" }}>
            <Text className="font-ui-semibold" style={{ fontSize: rf(amountSize * 0.5), color: signColor }}>{kind === "expense" ? "−$" : "+$"}</Text>
            <TextInput
              value={amountInput}
              onChangeText={(t) => setAmountInput(cleanAmount(t))}
              placeholder="0"
              placeholderTextColor={colors["text-3"]}
              keyboardType="decimal-pad"
              autoFocus
              accessibilityLabel="Amount"
              className="font-ui-semibold text-text"
              style={{ fontSize: rf(amountSize), width: amountWidth + 6, paddingVertical: 0, paddingHorizontal: 0 }}
            />
            {/* Invisible twin, same font and size, measured for the field's width. */}
            <Text
              className="font-ui-semibold"
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onLayout={(e) => setAmountWidth(Math.ceil(e.nativeEvent.layout.width))}
              style={{ position: "absolute", opacity: 0, fontSize: rf(amountSize) }}
            >
              {amountInput || "0"}
            </Text>
          </View>
          <Text style={{ fontFamily: "JetBrainsMono", fontSize: rf(11), letterSpacing: 0.4, color: colors["text-3"], marginTop: -4 }}>{DEFAULT_CURRENCY}</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text className="font-ui-semibold text-text-3 px-1" style={caption}>What was it</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Tim Hortons"
            placeholderTextColor={colors["text-3"]}
            accessibilityLabel="What was it"
            className="rounded-control px-[14px] font-ui text-text border-field border-field-line"
            style={{ height: 48, fontSize: rf(15), backgroundColor: glassFill }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text className="font-ui-semibold text-text-3 px-1" style={caption}>Category</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {chips.map((c) => (
              <Chip
                key={c.id}
                fill={glassFill}
                label={c.name}
                dot={series[(c.colorSlot - 1 + 8) % 8]}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
              />
            ))}
            <Chip fill={glassFill} label="All…" accent selected={false} onPress={() => setPickerOpen(true)} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text className="font-ui-semibold text-text-3 px-1" style={caption}>When</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip fill={glassFill} label="Today" selected={isToday} onPress={() => { setDate(new Date()); setShowIOSPicker(false); }} />
            <Chip fill={glassFill} label="Yesterday" selected={isYesterday} onPress={() => { setDate(yesterday()); setShowIOSPicker(false); }} />
            <Pressable
              onPress={openDatePicker}
              accessibilityRole="button"
              accessibilityState={{ selected: customDate }}
              className="flex-row items-center rounded-full"
              style={{
                height: 36,
                paddingHorizontal: customDate ? 13 : 14,
                gap: 8,
                borderWidth: customDate ? 2 : 1,
                borderColor: customDate ? colors.ink : colors.border,
                backgroundColor: customDate ? colors["brand-subtle"] : glassFill,
              }}
            >
              <Calendar size={15} color={colors["text-2"]} />
              <Text className={customDate ? "font-ui-semibold" : "font-ui-medium"} style={{ fontSize: rf(14), color: colors.text }}>
                {customDate ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) : "Pick a date"}
              </Text>
            </Pressable>
          </View>
          {Platform.OS === "ios" && showIOSPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              maximumDate={new Date()}
              themeVariant={colorScheme === "dark" ? "dark" : "light"}
              accentColor={colors.brand}
              onChange={(_, selected) => {
                if (selected) setDate(selected);
              }}
            />
          )}
        </View>

        {allAccounts.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text className="font-ui-semibold text-text-3 px-1" style={caption}>{kind === "expense" ? "Paid from" : "Deposited to"}</Text>
            <Pressable
              onPress={() => setPickingAccount(true)}
              accessibilityRole="button"
              accessibilityLabel={selectedAccount ? `Account, ${selectedAccount.name}` : "Choose an account"}
              className="flex-row items-center rounded-card"
              style={{ height: 52, paddingHorizontal: 14, gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: glassFill }}
            >
              <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: withAlpha(colors["text-3"]!, 0.16) }}>
                <Landmark size={16} color={selectedAccount ? colors["text-2"] : colors["text-3"]} strokeWidth={2} />
              </View>
              <Text
                numberOfLines={1}
                className={selectedAccount ? "flex-1 font-ui-medium text-text" : "flex-1 font-ui text-text-3"}
                style={{ fontSize: rf(15) }}
              >
                {selectedAccount ? selectedAccount.name : "Choose an account"}
                {selectedAccount?.mask ? <Text style={{ fontFamily: "JetBrainsMono", fontSize: rf(12.5), color: colors["text-3"] }}>{`  ····${selectedAccount.mask}`}</Text> : null}
              </Text>
              <ChevronRight size={16} color={colors["text-3"]} />
            </Pressable>
          </View>
        )}

        {error && <SheetError>{error}</SheetError>}
      </ScrollView>

      <View className="px-5 pt-3" style={{ paddingBottom: 24 }}>
        <PillButton
          label={`Add ${kind}${formatted ? ` · ${formatted}` : ""}`}
          onPress={submit}
          loading={createTransaction.isPending}
          disabled={!canSubmit}
        />
      </View>

      <CategoryPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={categoryId}
        onSelect={setCategoryId}
        categories={categories.filter((c) => c.kind === kind)}
      />
      <SimplePickerSheet
        visible={pickingAccount}
        onClose={() => setPickingAccount(false)}
        title={kind === "expense" ? "Paid from" : "Deposited to"}
        items={allAccounts.map((a) => ({ id: a.id, label: a.name, sublabel: a.mask ? `····${a.mask}` : undefined }))}
        selectedId={accountId}
        onSelect={setAccountId}
      />
    </Sheet>
  );
}
