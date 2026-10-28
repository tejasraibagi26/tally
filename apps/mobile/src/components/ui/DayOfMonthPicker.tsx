import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { Sheet } from "@/components/ui/Sheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** "18th", "Last day", "Not set": day 0 is the month's last day, null is unset. */
export function dayOfMonthLabel(day: number | null): string {
  if (day == null) return "Not set";
  if (day === 0) return "Last day";
  const rem = day % 100;
  if (rem >= 11 && rem <= 13) return `${day}th`;
  return `${day}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th"}`;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Mobile's copy of web's components/ui/DayOfMonthPicker.tsx: a compact
 * button that opens a bottom sheet with a calendar-style grid of 1-31,
 * then "Last day" and Clear. One tap picks and closes.
 */
export function DayOfMonthPicker({ value, onChange, disabled, label }: { value: number | null; onChange: (day: number | null) => void; disabled?: boolean; label: string }) {
  const colors = useThemeColors();
  const rf = useRF();
  const [open, setOpen] = useState(false);

  function pick(day: number | null) {
    setOpen(false);
    if (day !== value) onChange(day);
  }

  const cell = (day: number | null, text: string, width: `${number}%`) => {
    const on = value === day;
    return (
      <View key={text} style={{ width, padding: 3 }}>
        <Pressable
          onPress={() => pick(day)}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          accessibilityLabel={day == null ? text : dayOfMonthLabel(day)}
          className="items-center justify-center rounded-control"
          style={{ height: 44, backgroundColor: on ? colors.brand : colors["surface-2"], borderWidth: on ? 2 : 0, borderColor: colors.ink ?? colors.brand }}
        >
          <Text className={on ? "font-ui-semibold" : "font-ui"} style={{ fontSize: rf(15), color: on ? colors["on-brand"] : colors.text, fontVariant: ["tabular-nums"] }}>{text}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${dayOfMonthLabel(value)}`}
        className="flex-row items-center gap-2 h-11 rounded-control bg-surface-2 px-3"
        style={{ borderWidth: 1, borderColor: colors["border-strong"], opacity: disabled ? 0.5 : 1 }}
      >
        <Text className="font-ui" style={{ fontSize: rf(15), color: value == null ? colors["text-3"] : colors.text }}>{dayOfMonthLabel(value)}</Text>
        <ChevronDown size={15} color={colors["text-3"]} strokeWidth={2} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View className="px-5 pt-1 pb-2 gap-3">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }}>{label}</Text>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
            {DAYS.map((d) => cell(d, String(d), `${100 / 7}%`))}
            {cell(0, "Last day", `${(100 / 7) * 4}%`)}
          </View>
          {value != null && (
            <Pressable onPress={() => pick(null)} hitSlop={8} className="self-center py-2" accessibilityRole="button">
              <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(14) }}>Clear</Text>
            </Pressable>
          )}
        </View>
      </Sheet>
    </>
  );
}
