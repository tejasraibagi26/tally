import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { YearEndGoal } from "@/components/goals/YearEndGoal";
import { RetirementGoal } from "@/components/goals/RetirementGoal";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

type View_ = "year" | "retirement";

const TABS: { view: View_; label: string }[] = [
  { view: "year", label: "Year-end goal" },
  { view: "retirement", label: "Early retirement" },
];

/**
 * Goals: the year-end net worth goal and the early-retirement planner, a
 * tab each (mobile v2.12.0 folded Early retirement in; web's /goals does
 * the same). ?view=retirement opens the planner -- where tally:// links to
 * /fire land.
 */
export default function GoalsScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<View_>(params.view === "retirement" ? "retirement" : "year");

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <View className="flex-row gap-1.5 px-5 pb-3" accessibilityRole="tablist">
        {TABS.map((t) => {
          const on = t.view === view;
          return (
            <Pressable
              key={t.view}
              onPress={() => setView(t.view)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              className={`rounded-full border-button border-ink px-3.5 py-1.5 ${on ? "bg-brand" : "bg-surface"}`}
            >
              <Text className="font-ui-semibold" style={{ fontSize: rf(13.5), color: on ? colors["on-brand"] : colors.text }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {view === "retirement" ? <RetirementGoal /> : <YearEndGoal />}
    </View>
  );
}
