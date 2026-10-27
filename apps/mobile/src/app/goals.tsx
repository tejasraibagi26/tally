import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { GoalChart } from "@/components/charts/GoalChart";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { GoalCard } from "@/components/overview/GoalCard";
import { useGoal, useRemoveGoal, useSaveGoal } from "@/lib/queries/goals";
import { useNetWorthTrend } from "@/lib/queries/overview";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * The year-end goal (Tally Pop only: reached from Overview's goal card and
 * the More sheet). Mobile's counterpart of web's /goals.
 */
export default function GoalsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const goal = useGoal();
  const trend = useNetWorthTrend();
  const save = useSaveGoal();
  const remove = useRemoveGoal();
  const [amount, setAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A finger on the chart locks the page so dragging along the line reads it instead of scrolling.
  const [scrubbing, setScrubbing] = useState(false);

  const g = goal.data?.goal ?? null;
  const p = goal.data?.projection;
  const shown = amount ?? (g ? String(g.targetCents / 100) : "");
  const points = (trend.data?.points ?? []).filter((pt) => !g || pt.asOfDate >= `${g.startDate.slice(0, 4)}-01-01`);

  function submit() {
    const cents = Math.round(Number(shown.replace(/[$,\s]/g, "")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter the net worth you want to reach.");
      return;
    }
    setError(null);
    save.mutate({ targetCents: cents, deadline: g?.deadline }, { onError: () => setError("Couldn't save the goal. Try again."), onSuccess: () => setAmount(null) });
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" scrollEnabled={!scrubbing} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}>
        {goal.isLoading ? (
          <ActivityIndicator />
        ) : (
          <>
            {g && <GoalCard summary={goal.data} />}

            {g && p && points.length > 1 && (
              <Card className="pt-5 pb-3 gap-3 overflow-hidden">
                <View className="px-5 gap-1">
                  <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>Where the pace lands</Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>Pace = net worth&apos;s average change over the last 3 full months</Text>
                </View>
                {/* Edge to edge of the card, like web's: the card has no side padding here. */}
                <GoalChart points={points} projected={p.projected} deadline={g.deadline} target={g.targetCents} onScrubbingChange={setScrubbing} />
              </Card>
            )}

            {(goal.data?.cuts?.length ?? 0) > 0 && (
              <Card className="px-5 py-2">
                <Text className="font-ui-semibold text-text py-3" style={{ fontSize: rf(16) }}>Where to find it</Text>
                {goal.data!.cuts!.map((c) => (
                  <Pressable key={c.key} onPress={() => router.push({ pathname: "/(tabs)/transactions", params: { category: c.key } })} className="flex-row items-center justify-between py-3 gap-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View className="flex-1">
                      <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>{c.label}</Text>
                      <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>usually {formatCents(c.avgMonthly)} a month</Text>
                    </View>
                    <Text className="font-ui-semibold text-text" style={{ fontSize: rf(14), fontVariant: ["tabular-nums"] }}>save {formatCents(c.save)}/mo</Text>
                  </Pressable>
                ))}
              </Card>
            )}

            <Card className="p-5 gap-3">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{g ? "Change the goal" : "Set a goal for the year"}</Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>Net worth to reach by {g ? new Date(`${g.deadline}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Dec 31"}, in CAD.</Text>
              <View className="flex-row items-center h-12 rounded-control px-4 gap-2" style={{ borderWidth: 1, borderColor: colors["border-strong"], backgroundColor: colors.surface }}>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(16) }}>$</Text>
                <TextInput
                  value={shown}
                  onChangeText={setAmount}
                  placeholder="200,000"
                  placeholderTextColor={colors["text-3"]}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Net worth to reach, CAD"
                  className="flex-1 font-ui text-text"
                  style={{ fontSize: rf(16), textAlign: "right", fontVariant: ["tabular-nums"] }}
                />
              </View>
              {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
              <Pressable onPress={submit} disabled={save.isPending} className="h-12 rounded-full bg-brand border-button border-ink items-center justify-center active:opacity-90 disabled:opacity-50">
                {save.isPending ? <ActivityIndicator color={colors["on-brand"]} /> : <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>{g ? "Save goal" : "Set goal"}</Text>}
              </Pressable>
              {g && (
                <Pressable onPress={() => remove.mutate()} disabled={remove.isPending} className="h-11 items-center justify-center">
                  <Text className="font-ui-semibold text-negative" style={{ fontSize: rf(14.5) }}>Remove goal</Text>
                </Pressable>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
