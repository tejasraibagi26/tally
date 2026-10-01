import { useMemo, useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { Calendar } from "lucide-react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useAccounts } from "@/lib/queries/accounts";
import { useCategories } from "@/lib/queries/categories";
import { useCreateBill } from "@/lib/queries/subscriptions";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { SimplePickerSheet } from "@/components/ui/SimplePickerSheet";
import { FormSheet, SheetAmountInput, SheetField, SheetInput, SheetPickerRow } from "@/components/ui/FormSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// Local Y/M/D, not toISOString() -- see AddTransactionSheet.tsx's note.
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Native port of web's AddBillForm.tsx: same fields and API contract
// (useCreateBill -> POST /api/recurring-streams).
export function AddBillSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createBill = useCreateBill();

  const accounts = useMemo(
    () => [...(accountsData?.institutions.flatMap((i) => i.accounts) ?? []), ...(accountsData?.unlinkedAccounts ?? [])],
    [accountsData],
  );
  const expenseCategories = useMemo(() => (categoriesData?.categories ?? []).filter((c) => c.kind === "expense"), [categoriesData]);

  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [pickingAccount, setPickingAccount] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);

  function handleClose() {
    setDescription("");
    setAmountInput("");
    setAccountId(null);
    setCategoryId(null);
    setDueDate(null);
    setShowIOSPicker(false);
    setError(null);
    onClose();
  }

  function openDatePicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: dueDate ?? new Date(),
        mode: "date",
        display: "default",
        onChange: (event, selected) => {
          if (event.type === "set" && selected) setDueDate(selected);
        },
      });
    } else {
      if (!dueDate) setDueDate(new Date());
      setShowIOSPicker((v) => !v);
    }
  }

  async function submit() {
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!description.trim() || !selectedAccount || !dueDate || !Number.isFinite(amount) || amount <= 0) {
      setError("Fill in a name, amount, account and next due date.");
      return;
    }
    setError(null);
    try {
      await createBill.mutateAsync({
        description: description.trim(),
        accountId: selectedAccount.id,
        categoryId,
        amount,
        manualNextDueDate: toDateString(dueDate),
      });
      handleClose();
    } catch {
      setError("Couldn't add the bill. Try again.");
    }
  }

  return (
    <FormSheet
      visible={visible}
      onClose={handleClose}
      title="Add a bill"
      description="For a recurring charge Tally hasn't picked up on its own, like rent paid in lump sums."
      onSubmit={submit}
      submitLabel="Add bill"
      submitting={createBill.isPending}
      error={error}
      overlays={
        <>
          <SimplePickerSheet
            visible={pickingAccount}
            onClose={() => setPickingAccount(false)}
            title="Paid from"
            items={accounts.map((a) => ({ id: a.id, label: a.name, sublabel: a.mask ? `····${a.mask}` : undefined }))}
            selectedId={selectedAccount?.id ?? null}
            onSelect={setAccountId}
          />
          <CategoryPickerSheet
            visible={pickingCategory}
            onClose={() => setPickingCategory(false)}
            selectedId={categoryId}
            onSelect={setCategoryId}
            categories={expenseCategories}
          />
        </>
      }
    >
      <SheetField label="Name">
        <SheetInput value={description} onChangeText={setDescription} placeholder="Rent" autoFocus />
      </SheetField>
      <SheetField label="Amount">
        <SheetAmountInput value={amountInput} onChangeText={setAmountInput} />
      </SheetField>
      <SheetField label="Paid from">
        <SheetPickerRow
          value={selectedAccount ? `${selectedAccount.name} ····${selectedAccount.mask ?? "----"}` : null}
          placeholder="Choose account"
          onPress={() => setPickingAccount(true)}
        />
      </SheetField>
      <SheetField label="Category">
        <SheetPickerRow value={selectedCategory?.name} placeholder="Uncategorized" onPress={() => setPickingCategory(true)} />
      </SheetField>
      <SheetField label="Next due">
        <Pressable onPress={openDatePicker} className="flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]" style={{ height: 46 }}>
          <Text className={dueDate ? "font-ui text-text" : "font-ui text-text-3"} style={{ fontSize: rf(14.5) }}>
            {dueDate ? dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Choose a date"}
          </Text>
          <Calendar size={16} color={colors["text-3"]} />
        </Pressable>
        {Platform.OS === "ios" && showIOSPicker && dueDate && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="inline"
            themeVariant={colorScheme === "dark" ? "dark" : "light"}
            accentColor={colors.brand}
            onChange={(_, selected) => {
              if (selected) setDueDate(selected);
            }}
          />
        )}
      </SheetField>
    </FormSheet>
  );
}
