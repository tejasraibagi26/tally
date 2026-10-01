import { type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, type TextInputProps } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Sheet } from "@/components/ui/Sheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * The one way every "add" flow opens on mobile (income schedule, API token,
 * bill) -- the bottom-sheet counterpart of web's FormPanel
 * (apps/web/components/ui/FormPanel.tsx), styled to match AddBudgetSheet:
 * title + optional description, scrolling fields, then a full-width submit
 * pill. Picker sheets a form opens go in `overlays`, rendered inside this
 * sheet's Modal so they stack over it (a second Modal opened from the
 * screen underneath wouldn't show on iOS while this one is up).
 */
export function FormSheet({
  visible,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel,
  submitting,
  submitDisabled,
  error,
  children,
  overlays,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitLabel: string;
  submitting: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  children: ReactNode;
  overlays?: ReactNode;
}) {
  const colors = useThemeColors();
  const rf = useRF();

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="85%">
      <View className="px-5 pt-1 pb-3 gap-1">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>{title}</Text>
        {description && <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>{description}</Text>}
      </View>

      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="px-5 gap-4" style={{ paddingBottom: 8 }}>
          {children}
          {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
        </View>
      </ScrollView>

      <View className="px-5 pt-3" style={{ paddingBottom: 24 }}>
        <Pressable
          onPress={onSubmit}
          disabled={submitting || submitDisabled}
          className="rounded-full bg-brand items-center justify-center active:opacity-90 disabled:opacity-50"
          style={{ height: 52 }}
        >
          {submitting ? (
            <ActivityIndicator color={colors["on-brand"]} />
          ) : (
            <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>

      {overlays}
    </Sheet>
  );
}

/** A labelled field inside a FormSheet. */
export function SheetField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const rf = useRF();
  return (
    <View className="gap-1.5">
      <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>{label}</Text>
      {children}
      {hint && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{hint}</Text>}
    </View>
  );
}

/** Text input styled like AddBudgetSheet's fields. */
export function SheetInput(props: TextInputProps) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <TextInput
      placeholderTextColor={colors["text-3"]}
      {...props}
      className="rounded-control bg-surface-2 px-[14px] font-ui text-text"
      style={[{ height: 46, fontSize: rf(14.5) }, props.style]}
    />
  );
}

/** "$" + decimal-pad amount input. */
export function SheetAmountInput({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-center rounded-control bg-surface-2 px-[14px]" style={{ height: 46 }}>
      <Text className="font-ui text-text-3" style={{ fontSize: rf(14.5) }}>$</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderTextColor={colors["text-3"]}
        keyboardType="decimal-pad"
        className="flex-1 font-ui text-text px-1.5"
        style={{ fontSize: rf(14.5), fontVariant: ["tabular-nums"] }}
      />
    </View>
  );
}

/** A tappable row that opens a picker sheet, showing the current choice. */
export function SheetPickerRow({ value, placeholder, onPress }: { value: string | null | undefined; placeholder: string; onPress: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between rounded-control bg-surface-2 px-[14px]" style={{ height: 46 }}>
      <Text className={value ? "font-ui text-text" : "font-ui text-text-3"} style={{ fontSize: rf(14.5) }} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
      <ChevronRight size={16} color={colors["text-3"]} />
    </Pressable>
  );
}
