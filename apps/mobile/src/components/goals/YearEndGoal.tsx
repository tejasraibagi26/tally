import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Info, Target } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { Skeleton } from "@/components/ui/Skeleton";
import { PillButton } from "@/components/ui/PillButton";
import { Card } from "@/components/ui/Card";
import { FormSheet, SheetAmountInput, SheetField, SheetError } from "@/components/ui/FormSheet";
import { GoalChart } from "@/components/charts/GoalChart";
import { GoalCard, usePrivateMoney } from "@/components/overview/GoalCard";
import { GoalHowItWorksDialog } from "@/components/overview/GoalHowItWorksDialog";
import { GoalRow, SectionLabel } from "@/components/goals/parts";
import { useGoal, useRemoveGoal, useSaveGoal } from "@/lib/queries/goals";
import { useNetWorthTrend } from "@/lib/queries/overview";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

function fullDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function parseCents(s: string) {
  return Math.round(Number(s.replace(/[$,\s]/g, "")) * 100);
}

/**
 * Goals' year-end tab (app/goals.tsx; reached from Overview's goal card and
 * the More sheet). Mobile's counterpart of web's /goals. Reworked in mobile
 * v2.15.1: the goal and its pace lead, then where to find the money, then
 * the goal's own settings as rows -- the target edits in a sheet, removing
 * it asks first. Without a goal, one card sets it. The screen's header and
 * tabs sit above, so nothing here pads for the header.
 */
export function YearEndGoal() {
  const goal = useGoal();
  const [howOpen, setHowOpen] = useState(false);
  const g = goal.data?.goal ?? null;

  return (
    <View className="flex-1">
      {goal.isLoading ? (
        <View className="px-5 gap-4">
          <Skeleton style={{ height: 190, borderRadius: 20 }} />
          <Skeleton style={{ height: 240, borderRadius: 20 }} />
        </View>
      ) : g ? (
        <WithGoal onHow={() => setHowOpen(true)} />
      ) : (
        <SetGoal onHow={() => setHowOpen(true)} />
      )}
      <GoalHowItWorksDialog visible={howOpen} onClose={() => setHowOpen(false)} />
    </View>
  );
}

function HowLink({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} className="self-center flex-row items-center gap-1.5 py-2 active:opacity-70">
      <Info size={15} color={colors.brand} strokeWidth={2} />
      <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>How year-end goals work</Text>
    </Pressable>
  );
}

/** No goal yet: one card that sets it. */
function SetGoal({ onHow }: { onHow: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const save = useSaveGoal();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const cents = parseCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) return setError("Enter the net worth you want to reach.");
    setError(null);
    save.mutate({ targetCents: cents }, { onError: () => setError("Couldn't save the goal. Try again.") });
  }

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 40 }}>
      <Card className="p-5 gap-4">
        <View className="w-12 h-12 rounded-control bg-brand-subtle items-center justify-center border-button border-ink">
          <Target size={24} color={colors.brand} strokeWidth={2} />
        </View>
        <View className="gap-1.5">
          <Text className="font-display text-text" style={{ fontSize: rf(26), lineHeight: rf(30) }}>Set a goal for the year</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(15), lineHeight: rf(21) }}>
            Pick a net worth to reach by Dec 31. Tally checks your pace every month and tells you what would close the gap.
          </Text>
        </View>
        <View className="gap-1.5">
          <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>Net worth to reach, in CAD</Text>
          <View className="flex-row items-center h-[52px] rounded-control px-4 gap-2 bg-surface-2 border-field border-ink">
            <Text className="font-ui text-text-3" style={{ fontSize: rf(18) }}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="200,000"
              placeholderTextColor={colors["text-3"]}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Net worth to reach, CAD"
              className="flex-1 font-ui-semibold text-text"
              style={{ fontSize: rf(18), fontVariant: ["tabular-nums"] }}
            />
          </View>
        </View>
        {error && <SheetError>{error}</SheetError>}
        <PillButton label="Set goal" onPress={submit} loading={save.isPending} disabled={!amount.trim()} />
      </Card>
      <HowLink onPress={onHow} />
    </ScrollView>
  );
}

/** A goal is set: the verdict, the pace, where to find it, then its settings. */
function WithGoal({ onHow }: { onHow: () => void }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const money = usePrivateMoney();
  const goal = useGoal();
  const trend = useNetWorthTrend();
  const save = useSaveGoal();
  const remove = useRemoveGoal();
  // A finger on the chart locks the page so dragging along the line reads it instead of scrolling.
  const [scrubbing, setScrubbing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const g = goal.data!.goal!;
  const p = goal.data?.projection;
  const cuts = goal.data?.cuts ?? [];
  const points = (trend.data?.points ?? []).filter((pt) => pt.asOfDate >= `${g.startDate.slice(0, 4)}-01-01`);

  function openEdit() {
    setDraft(String(g.targetCents / 100));
    setError(null);
    setEditOpen(true);
  }
  function submit() {
    const cents = parseCents(draft);
    if (!Number.isFinite(cents) || cents <= 0) return setError("Enter the net worth you want to reach.");
    setError(null);
    save.mutate({ targetCents: cents, deadline: g.deadline }, { onError: () => setError("Couldn't save the goal. Try again."), onSuccess: () => setEditOpen(false) });
  }
  function confirmRemove() {
    Alert.alert("Remove this goal?", "Tally stops tracking the pace. Your net worth history stays as it is, and you can set a new goal any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove goal", style: "destructive", onPress: () => remove.mutate() },
    ]);
  }

  return (
    <>
      <ScrollView className="flex-1" scrollEnabled={!scrubbing} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}>
        <GoalCard summary={goal.data} showCurrent linked={false} />

        {p && points.length > 1 && (
          <Card className="pt-5 pb-3 gap-3 overflow-hidden">
            <View className="px-5 gap-1">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>Where the pace lands</Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>Pace is net worth&apos;s average change over the last 3 full months.</Text>
            </View>
            {/* Edge to edge of the card: the card has no side padding here. */}
            <GoalChart points={points} projected={p.projected} deadline={g.deadline} target={g.targetCents} onScrubbingChange={setScrubbing} />
          </Card>
        )}

        {cuts.length > 0 && (
          <>
            <SectionLabel>Where to find it</SectionLabel>
            <Card className="px-5">
              {cuts.map((c, i) => (
                <Pressable
                  key={c.key}
                  onPress={() => router.push({ pathname: "/(tabs)/transactions", params: { category: c.key } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label}, usually ${formatCents(c.avgMonthly)} a month. Save ${formatCents(c.save)} a month.`}
                  className="flex-row items-center gap-3 py-3.5 active:opacity-70"
                  style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }}>{c.label}</Text>
                    <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>usually {formatCents(c.avgMonthly)} a month</Text>
                  </View>
                  <View className="rounded-full bg-positive-subtle px-2.5 py-1">
                    <Text className="font-ui-semibold text-positive" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>save {formatCents(c.save)}/mo</Text>
                  </View>
                  <ChevronRight size={16} color={colors["text-3"]} strokeWidth={2} />
                </Pressable>
              ))}
            </Card>
          </>
        )}

        <SectionLabel>Your goal</SectionLabel>
        <Card className="px-5">
          <GoalRow first label="Target" value={money(g.targetCents)} onPress={openEdit} accessibilityLabel="Change the target" />
          <GoalRow label="Deadline" value={fullDate(g.deadline)} />
          <GoalRow label="Remove goal" tone="negative" onPress={remove.isPending ? undefined : confirmRemove} />
        </Card>
        <HowLink onPress={onHow} />
      </ScrollView>

      <FormSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Change the target"
        description={`Net worth to reach by ${fullDate(g.deadline)}, in CAD.`}
        onSubmit={submit}
        submitLabel="Save goal"
        submitting={save.isPending}
        submitDisabled={!draft.trim()}
        error={error}
      >
        <SheetField label="Target">
          <SheetAmountInput value={draft} onChangeText={setDraft} />
        </SheetField>
      </FormSheet>
    </>
  );
}
