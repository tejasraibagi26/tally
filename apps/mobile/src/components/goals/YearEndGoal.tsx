import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { View, Text, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { PillButton } from "@/components/ui/PillButton";
import { useRouter } from "expo-router";
import { Info } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { GoalChart } from "@/components/charts/GoalChart";
import { GoalCard } from "@/components/overview/GoalCard";
import { GoalHowItWorksDialog } from "@/components/overview/GoalHowItWorksDialog";
import { useGoal, useRemoveGoal, useSaveGoal } from "@/lib/queries/goals";
import { useNetWorthTrend } from "@/lib/queries/overview";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Goals' year-end tab (app/goals.tsx; reached from Overview's goal card and
 * the More sheet). Mobile's counterpart of web's /goals. The screen's
 * header and tabs sit above it, so nothing here pads for the header.
 */
export function YearEndGoal() {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const goal = useGoal();
  const trend = useNetWorthTrend();
  const save = useSaveGoal();
  const remove = useRemoveGoal();
  const [amount, setAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A finger on the chart locks the page so dragging along the line reads it instead of scrolling.
  const [scrubbing, setScrubbing] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

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

  function confirmRemove() {
    Alert.alert("Remove this goal?", "Tally stops tracking the pace. Your net worth history stays as it is, and you can set a new goal any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove goal", style: "destructive", onPress: () => remove.mutate() },
    ]);
  }

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" scrollEnabled={!scrubbing} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}>
        {goal.isLoading ? (
          <>
            <Skeleton style={{ height: 36, width: 200 }} />
            <Skeleton style={{ height: 200, borderRadius: 18 }} />
          </>
        ) : (
          <>
            <Pressable onPress={() => setHowOpen(true)} accessibilityRole="button" className="self-start flex-row items-center gap-1.5 h-9 px-3.5 rounded-full border-button border-ink active:opacity-80" style={{ backgroundColor: colors.surface }}>
              <Info size={15} color={colors.text} strokeWidth={2} />
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(13.5) }}>How it works</Text>
            </Pressable>
            {g && <GoalCard summary={goal.data} showCurrent linked={false} />}

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
              <PillButton label={g ? "Save goal" : "Set goal"} onPress={submit} loading={save.isPending} size="md" />
              {g && (
                <Pressable onPress={confirmRemove} disabled={remove.isPending} className="h-11 items-center justify-center">
                  <Text className="font-ui-semibold text-negative" style={{ fontSize: rf(14.5) }}>Remove goal</Text>
                </Pressable>
              )}
            </Card>
          </>
        )}
      </ScrollView>
      <GoalHowItWorksDialog visible={howOpen} onClose={() => setHowOpen(false)} />
    </View>
  );
}
