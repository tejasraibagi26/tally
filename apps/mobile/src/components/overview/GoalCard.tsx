import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Flag, Target, type LucideIcon } from "lucide-react-native";
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
/**
 * `showCurrent`: the Goals screen adds today's net worth to the sub line;
 * Overview leaves it out, since the net worth card above already shows it.
 * `linked={false}` on the Goals screen itself, where a tap pushed another
 * copy of the screen it's already on.
 */
export function GoalCard({ summary, showCurrent = false, linked = true }: { summary: GoalSummary | undefined; showCurrent?: boolean; linked?: boolean }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const money = usePrivateMoney();
  if (!summary) return null;
  if (!summary.goal || !summary.projection) {
    return (
      <Pressable onPress={() => router.push("/goals" as Href)} disabled={!linked} accessibilityRole={linked ? "button" : undefined} accessibilityLabel="Set a goal for the year">
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
    <Pressable onPress={() => router.push("/goals" as Href)} disabled={!linked} accessibilityRole={linked ? "button" : undefined} accessibilityLabel={`Year-end goal, ${status.label}. ${goalLine(summary, money)}`}>
      <Card className="p-5 gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>Year-end goal</Text>
        <Text className="font-display text-text" style={{ fontSize: rf(28), fontVariant: ["tabular-nums"] }}>
          {p.status === "reached" ? "Reached" : money(p.gap)}
        </Text>
        {/* Leads with what's left, not net worth again (Overview's card above has it). One size per line. */}
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }}>
          {p.status === "reached" ? `Your ${money(p.target)} target, ${money(p.current - p.target)} past it` : `left to reach ${money(p.target)} by ${deadlineLabel(summary.goal.deadline)}`}
          {showCurrent ? ` · now ${money(p.current)}` : ""}
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
  const tone = colors[status.tone]!;
  // One line: the verdict, then the one number that matters next to a budget.
  const detail =
    p.status === "off_track"
      ? `spend ${money(Math.round(p.shortBy!))} less a month`
      : p.status === "on_track"
        ? `${money(p.gap)} to go`
        : p.status === "reached"
          ? "target reached"
          : null;
  return (
    <Pressable
      onPress={() => router.push("/goals" as Href)}
      className="flex-row items-center gap-2.5 mt-3 rounded-control border-card border-ink bg-surface px-3.5 py-2.5 active:opacity-80"
      accessibilityRole="link"
      accessibilityLabel={`Year-end goal, ${status.label}${detail ? `, ${detail}` : ""}`}
    >
      <status.icon size={16} color={tone} strokeWidth={2.25} />
      <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        <Text className="font-ui-semibold text-text">Year-end goal</Text> · <Text className="font-ui-semibold" style={{ color: tone }}>{status.label}</Text>
        {detail ? ` · ${detail}` : ""}
      </Text>
      <ChevronRight size={16} color={colors["text-3"]} strokeWidth={2.25} />
    </Pressable>
  );
}
