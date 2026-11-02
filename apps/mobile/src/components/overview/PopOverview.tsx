import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { isFirstDayOfMonth, onPaceLine } from "@tally/core/popView";
import { todayISO } from "@/lib/today";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { useThemeColors } from "@/theme/useThemeColors";
import { useStickerShadow } from "@/components/ui/Card";
import { useRF } from "@/theme/responsiveFont";

/*
 * Overview's Pop pieces (mobile's copy of web's
 * components/overview/PopOverview.tsx).
 */

/**
 * The net-worth hero. Pop Calm (mobile v2.18.0) unboxes it: the figure and
 * its chart sit straight on the canvas, as MOBILE_DESIGN.md first had it,
 * instead of on a solid grape card with a marigold shadow. NetWorthHero's
 * chart keeps its -20 margin, which now runs it to the screen's edges.
 */
export function HeroSurface({ children }: { children: ReactNode }) {
  return <View>{children}</View>;
}

/** On-pace days: finished days in a row under an even daily pace, as tally marks on a plain card (marigold is the marks' accent only). */
export function OnPaceCard({ streak, dailyPace, compact = false }: { streak: number; dailyPace: number; /** One row under the safe to spend card: marks, count, a short line. */ compact?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
  const sticker = useStickerShadow();
  const ink = colors.text!;
  // The device's date: the user's own day. On the month's first day nothing
  // has finished yet, so the card says "New month" instead of a zero.
  const today = todayISO();
  const fresh = isFirstDayOfMonth(today);
  const line = onPaceLine(streak, dailyPace, today, (c) => formatCents(c));
  if (compact) {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/transactions")}
        className="rounded-card bg-surface px-4 py-3 flex-row items-center gap-3 active:opacity-90"
        style={sticker}
        accessibilityRole="button"
        accessibilityLabel={fresh ? `On-pace days: new month. ${line}` : `On-pace days: ${streak}. ${line}`}
      >
        {fresh ? (
          <Text className="font-ui-semibold flex-1" style={{ color: ink, fontSize: rf(13.5) }} numberOfLines={2}>
            <Text className="font-display" style={{ fontSize: rf(17) }}>New month</Text> · stay under {formatCents(dailyPace)} today
          </Text>
        ) : (
          <>
            {streak > 0 && <TallyMarks count={streak} height={24} color={ink} accent={colors.brand!} />}
            <Text className="font-ui-semibold" style={{ color: ink, fontSize: rf(28), lineHeight: rf(32), fontVariant: ["tabular-nums"] }}>{streak}</Text>
            <Text className="font-ui-semibold flex-1" style={{ color: ink, fontSize: rf(13.5) }} numberOfLines={2}>
              {streak === 1 ? "day" : "days"} under your {formatCents(dailyPace)} pace
            </Text>
          </>
        )}
        <ChevronRight size={16} color={colors["text-3"]} strokeWidth={2.2} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/transactions")}
      className="rounded-card bg-surface p-5 gap-3 active:opacity-90"
      style={sticker}
      accessibilityRole="button"
      accessibilityLabel={fresh ? `On-pace days: new month. ${line}` : `On-pace days: ${streak}. ${line}`}
    >
      <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(14) }}>On-pace days</Text>
      <View className="flex-row items-center gap-4" style={{ minHeight: 44 }}>
        {fresh ? (
          <Text className="font-display" style={{ color: ink, fontSize: rf(26), lineHeight: rf(30) }}>New month</Text>
        ) : (
          <>
            <TallyMarks count={streak} height={44} color={ink} accent={colors.brand!} />
            <Text className="font-ui-semibold" style={{ color: ink, fontSize: rf(36), lineHeight: rf(40), fontVariant: ["tabular-nums"] }}>{streak}</Text>
          </>
        )}
      </View>
      <Text className="font-ui-medium" style={{ color: ink, fontSize: rf(14.5), lineHeight: rf(20) }}>{line}</Text>
    </Pressable>
  );
}
