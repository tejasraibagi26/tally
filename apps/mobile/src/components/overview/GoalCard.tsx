import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AlertTriangle, CheckCircle2, Clock, Flag, Target, type LucideIcon } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import type { GoalStatus } from "@tally/core/goalMath";
import { Card } from "@/components/ui/Card";
import type { GoalSummary } from "@/lib/queries/goals";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { usePrivacy } from "@/lib/PrivacyContext";

// Mobile's copy of apps/web/lib/goalCopy.ts + components/goals/GoalCard.tsx:
// the same words, so web, mobile and email say the same thing.
const STATUS: Record<GoalStatus, { label: string; tone: "positive" | "warning" | "text-2"; icon: LucideIcon }> = {
  on_track: { label: "On track", tone: "positive", icon: CheckCircle2 },
  off_track: { label: "Off track", tone: "warning", icon: AlertTriangle },
  reached: { label: "Reached", tone: "positive", icon: Flag },
  ended: { label: "Deadline passed", tone: "text-2", icon: Clock },
  unknown: { label: "Needs a month of history", tone: "text-2", icon: Clock },
};

export function deadlineLabel(deadline: string): string {
  return new Date(`${deadline}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Net worth figures follow "hide amounts" (goal amounts are net worth); spending never does. */
type Fmt = (cents: number) => string;
export function usePrivateMoney(): Fmt {
  const { hidden } = usePrivacy();
  return (c) => (hidden ? "••••••" : formatCents(c));
}

export function goalLine(s: GoalSummary, money: Fmt = formatCents): string {
  const p = s.projection!;
  const by = deadlineLabel(s.goal!.deadline);
  if (p.status === "reached") return `You passed ${money(p.target)} with ${money(p.current - p.target)} to spare.`;
  if (p.status === "ended") return `Ended ${money(p.gap)} short of the target.`;
  if (p.status === "unknown") return `Needs ${money(Math.round(p.neededPerMonth ?? 0))} a month to get there by ${by}.`;
  if (p.status === "on_track") return `Projected ${by}: ${money(Math.round(p.projected!))}.`;
  return `Projected ${by}: ${money(Math.round(p.projected!))}. ${money(Math.round(p.shortBy!))} more a month closes it.`;
}

/**
 * The year-end goal on Overview (Tally Pop only; the caller checks). Taps
 * through to the Goals screen. Without a goal: one line, one action.
 */
export function GoalCard({ summary }: { summary: GoalSummary | undefined }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const money = usePrivateMoney();
  if (!summary) return null;
  if (!summary.goal || !summary.projection) {
    return (
      <Pressable onPress={() => router.push("/goals" as Href)} accessibilityRole="button" accessibilityLabel="Set a goal for the year">
        <Card className="p-5 flex-row items-center gap-3.5">
          <View className="w-10 h-10 rounded-control bg-brand-subtle items-center justify-center">
            <Target size={20} color={colors.brand} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15.5) }}>Set a goal for the year</Text>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>Pick a net worth to reach by Dec 31.</Text>
          </View>
        </Card>
      </Pressable>
    );
  }
  const p = summary.projection;
  const status = STATUS[p.status];
  const tone = colors[status.tone]!;
  const toneBg = status.tone === "text-2" ? colors.sunken! : colors[`${status.tone}-subtle`]!;
  return (
    <Pressable onPress={() => router.push("/goals" as Href)} accessibilityRole="button" accessibilityLabel={`Year-end goal, ${status.label}. ${goalLine(summary, money)}`}>
      <Card className="p-5 gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>Year-end goal</Text>
        <Text className="font-display text-text" style={{ fontSize: rf(28), fontVariant: ["tabular-nums"] }}>
          {money(p.current)}
        </Text>
        {/* One size per line, so the masked dots read evenly too. */}
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }}>
          of {money(p.target)} · {p.status === "reached" ? "reached" : `${money(p.gap)} to go by ${deadlineLabel(summary.goal.deadline)}`}
        </Text>
        <View className="h-3 rounded-full bg-sunken overflow-hidden border-card border-ink">
          <View className="h-full rounded-full bg-brand" style={{ width: `${p.progress * 100}%` }} />
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: toneBg }}>
            <status.icon size={13} color={tone} strokeWidth={2.25} />
            <Text className="font-ui-semibold" style={{ fontSize: rf(12.5), color: tone }}>{status.label}</Text>
          </View>
          <Text className="font-ui text-text flex-shrink" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }}>{goalLine(summary, money)}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

/** Budgets' one line about the goal (Tally Pop, current month); taps through to Goals. */
export function GoalBudgetLine({ summary }: { summary: GoalSummary | undefined }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const money = usePrivateMoney();
  if (!summary?.goal || !summary.projection) return null;
  const p = summary.projection;
  const status = STATUS[p.status];
  const words =
    p.status === "off_track"
      ? `Year-end goal is off track: spending ${money(Math.round(p.shortBy!))} less a month closes it.`
      : p.status === "on_track"
        ? `Year-end goal is on track, ${money(p.gap)} to go. Staying on budget keeps it there.`
        : `Year-end goal: ${status.label.toLowerCase()}.`;
  return (
    <Pressable onPress={() => router.push("/goals" as Href)} className="flex-row items-start gap-2 mt-3" accessibilityRole="link">
      <status.icon size={15} color={colors[status.tone]} strokeWidth={2.25} style={{ marginTop: 2 }} />
      <Text className="font-ui text-text flex-1" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }}>{words}</Text>
    </Pressable>
  );
}
