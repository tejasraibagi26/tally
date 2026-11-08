import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AlertTriangle, CheckCircle2, Clock, Flag, type LucideIcon } from "lucide-react-native";
import type { GoalStatus } from "@tally/core/goalMath";
import { useStickerShadow } from "@/components/ui/Card";
import { deadlineLabel, usePrivateMoney } from "@/components/overview/GoalCard";
import type { GoalSummary } from "@/lib/queries/goals";
import { useRF } from "@/theme/responsiveFont";

// Mirrors apps/web/components/goalview/GoalStand.tsx: net worth leads, with
// the goal that gives it a point. The bar runs from where the goal started
// to the target, filled to today, with a dot where the current pace lands
// you. A dot short of the right edge is the message.

const STATUS: Record<GoalStatus, { label: string; icon: LucideIcon }> = {
  on_track: { label: "On track", icon: CheckCircle2 },
  off_track: { label: "Off track", icon: AlertTriangle },
  reached: { label: "Reached", icon: Flag },
  ended: { label: "Deadline passed", icon: Clock },
  unknown: { label: "Needs a month of history", icon: Clock },
};

/** The solid grape hero keeps its own colours in both schemes (DESIGN.md §1a). */
const HERO_BG = "#5B3BF5";
const ON_HERO = "#FFFFFF";
const ON_HERO_DIM = "#E6E0FF";
const MARIGOLD = "#FFC53D";

export function GoalStand({ netWorth, summary, deltaLine }: { netWorth: number; summary: GoalSummary | undefined; deltaLine?: string | null }) {
  const router = useRouter();
  const rf = useRF();
  const money = usePrivateMoney();
  const shadow = useStickerShadow();

  const p = summary?.projection;
  const goal = summary?.goal;
  const status = p ? STATUS[p.status] : null;
  const Icon = status?.icon;
  const projectedPct =
    p?.projected != null && goal && goal.targetCents > goal.startCents
      ? Math.min(1, Math.max(0, (p.projected - goal.startCents) / (goal.targetCents - goal.startCents)))
      : null;

  return (
    <Pressable onPress={() => router.push("/goals" as Href)} accessibilityRole="button">
      <View className="rounded-card p-5" style={[{ backgroundColor: HERO_BG }, shadow]}>
        <Text className="font-ui-semibold uppercase" style={{ fontSize: rf(11), letterSpacing: 0.7, color: ON_HERO_DIM }}>
          Net worth
        </Text>
        <Text className="font-display" style={{ fontSize: rf(40), lineHeight: rf(44), color: ON_HERO }}>
          {money(netWorth)}
        </Text>
        {deltaLine && (
          <Text className="font-ui" style={{ fontSize: rf(12.5), color: ON_HERO_DIM, marginTop: 4 }}>
            {deltaLine}
          </Text>
        )}

        {goal && p ? (
          <>
            <View style={{ marginTop: 18 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: MARIGOLD, width: `${p.progress * 100}%` }} />
                {projectedPct != null && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      left: `${projectedPct * 100}%`,
                      marginLeft: -5,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: ON_HERO,
                    }}
                  />
                )}
              </View>
              <View className="flex-row justify-between" style={{ marginTop: 8 }}>
                <Text className="font-ui" style={{ fontSize: rf(11), color: ON_HERO_DIM }}>
                  Started {money(goal.startCents)}
                </Text>
                <Text className="font-ui-semibold" style={{ fontSize: rf(11), color: ON_HERO }}>
                  Target {money(goal.targetCents)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)" }}>
              <View
                className="flex-row items-center"
                style={{ alignSelf: "flex-start", gap: 5, backgroundColor: ON_HERO, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}
              >
                {Icon && <Icon size={12} color={HERO_BG} strokeWidth={2.5} />}
                <Text className="font-ui-semibold" style={{ fontSize: rf(11.5), color: HERO_BG }}>
                  {status?.label}
                </Text>
              </View>
              <Text className="font-display" style={{ fontSize: rf(24), lineHeight: rf(29), color: ON_HERO, marginTop: 8 }}>
                {p.status === "reached"
                  ? "Reached"
                  : p.status === "off_track" && p.shortBy != null
                    ? `${money(p.shortBy)} a month short`
                    : p.neededPerMonth != null
                      ? `${money(p.neededPerMonth)} a month from here`
                      : "Needs a month of history"}
              </Text>
              {p.projected != null && (
                <Text className="font-ui" style={{ fontSize: rf(12.5), color: ON_HERO_DIM, marginTop: 4 }}>
                  At the last three months{"'"} pace you land on {money(Math.round(p.projected))} by {deadlineLabel(goal.deadline)}.
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text className="font-ui" style={{ fontSize: rf(13), color: ON_HERO_DIM, marginTop: 14 }}>
            Set a net worth to reach by Dec 31 and everything below starts answering whether you will get there.
          </Text>
        )}
      </View>
    </Pressable>
  );
}
