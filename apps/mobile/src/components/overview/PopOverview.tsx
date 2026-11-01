import type { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useColorScheme, vars } from "nativewind";
import { formatCents } from "@tally/core/money";
import { isFirstDayOfMonth, onPaceLine } from "@tally/core/popView";
import { todayISO } from "@/lib/today";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { ThemeColorsOverride, useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/*
 * Overview's Pop pieces (mobile's copy of web's
 * components/overview/PopOverview.tsx).
 */

// What sits on the solid net-worth card: every pair AA on its ground.
const HERO = {
  light: {
    text: "#FFFFFF",
    "text-2": "#E6E0FF",
    "text-3": "#E6E0FF",
    brand: "#FFFFFF",
    "brand-subtle": "#4A2DD6",
    positive: "#0F7A43",
    negative: "#C2341F",
    "positive-subtle": "#FFFFFF",
    "negative-subtle": "#FFFFFF",
  },
  dark: {
    text: "#14121F",
    "text-2": "#2A2150",
    "text-3": "#2A2150",
    brand: "#14121F",
    "brand-subtle": "#B7A8FF",
    positive: "#4FD69C",
    negative: "#FF8A73",
    "positive-subtle": "#14121F",
    "negative-subtle": "#14121F",
  },
};

function asVars(colors: Record<string, string>) {
  return vars(Object.fromEntries(Object.entries(colors).map(([k, v]) => [`--color-${k}`, v])));
}
const HERO_VARS = { light: asVars(HERO.light), dark: asVars(HERO.dark) };

/** The iOS hard offset shadow behind a sticker card (Card.tsx does the same). */
function useSticker() {
  const colors = useThemeColors();
  return Platform.OS === "ios" ? { shadowColor: colors["ink-shadow"], shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 } : null;
}

/**
 * The net-worth hero on a solid brand card. Its text, money and chart
 * colors are re-declared for that ground -- as NativeWind vars for
 * classNames and through ThemeColorsOverride for raw hex -- so NetWorthHero
 * renders unchanged inside it. 20px padding matches the -20 margin its
 * chart already uses to run edge to edge.
 */
export function HeroSurface({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const sticker = useSticker();
  // Two views: iOS drops the shadow of a view that clips (overflow-hidden,
  // needed so the chart's square ends follow the card's corners).
  return (
    <View className="rounded-card" style={sticker}>
      <View
        className="rounded-card border-card border-ink overflow-hidden"
        style={[{ backgroundColor: colors["hero-bg"], paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }, HERO_VARS[scheme]]}
      >
        <ThemeColorsOverride.Provider value={HERO[scheme]}>{children}</ThemeColorsOverride.Provider>
      </View>
    </View>
  );
}

/** On-pace days: finished days in a row under an even daily pace, as tally marks on marigold. */
export function OnPaceCard({ streak, dailyPace, compact = false }: { streak: number; dailyPace: number; /** One row under the safe to spend card: marks, count, a short line. */ compact?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
  const sticker = useSticker();
  const ink = colors["on-marigold"]!;
  // The device's date: the user's own day. On the month's first day nothing
  // has finished yet, so the card says "New month" instead of a zero.
  const today = todayISO();
  const fresh = isFirstDayOfMonth(today);
  const line = onPaceLine(streak, dailyPace, today, (c) => formatCents(c));
  if (compact) {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/transactions")}
        className="rounded-card border-card border-ink px-4 py-3 flex-row items-center gap-3 active:opacity-90"
        style={[{ backgroundColor: colors.marigold }, sticker]}
        accessibilityRole="button"
        accessibilityLabel={fresh ? `On-pace days: new month. ${line}` : `On-pace days: ${streak}. ${line}`}
      >
        {fresh ? (
          <Text className="font-ui-semibold flex-1" style={{ color: ink, fontSize: rf(13.5) }} numberOfLines={2}>
            <Text className="font-display" style={{ fontSize: rf(17) }}>New month</Text> · stay under {formatCents(dailyPace)} today
          </Text>
        ) : (
          <>
            {streak > 0 && <TallyMarks count={streak} height={24} color={ink} accent={colors["marigold-accent"]!} />}
            <Text className="font-display" style={{ color: ink, fontSize: rf(28), lineHeight: rf(32), fontVariant: ["tabular-nums"] }}>{streak}</Text>
            <Text className="font-ui-semibold flex-1" style={{ color: ink, fontSize: rf(13.5) }} numberOfLines={2}>
              {streak === 1 ? "day" : "days"} under your {formatCents(dailyPace)} pace
            </Text>
          </>
        )}
        <ChevronRight size={16} color={ink} strokeWidth={2.4} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/transactions")}
      className="rounded-card border-card border-ink p-5 gap-3 active:opacity-90"
      style={[{ backgroundColor: colors.marigold }, sticker]}
      accessibilityRole="button"
      accessibilityLabel={fresh ? `On-pace days: new month. ${line}` : `On-pace days: ${streak}. ${line}`}
    >
      <Text className="font-ui-semibold" style={{ color: ink, fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>On-pace days</Text>
      <View className="flex-row items-center gap-4" style={{ minHeight: 44 }}>
        {fresh ? (
          <Text className="font-display" style={{ color: ink, fontSize: rf(34), lineHeight: rf(40) }}>New month</Text>
        ) : (
          <>
            <TallyMarks count={streak} height={44} color={ink} accent={colors["marigold-accent"]!} />
            <Text className="font-display" style={{ color: ink, fontSize: rf(48), lineHeight: rf(52), fontVariant: ["tabular-nums"] }}>{streak}</Text>
          </>
        )}
      </View>
      <Text className="font-ui-medium" style={{ color: ink, fontSize: rf(14.5), lineHeight: rf(20) }}>{line}</Text>
    </Pressable>
  );
}
