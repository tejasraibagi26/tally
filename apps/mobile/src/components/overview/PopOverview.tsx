import type { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme, vars } from "nativewind";
import { formatCents } from "@tally/core/money";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { ThemeColorsOverride, useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/*
 * Overview pieces that only exist in the Tally Pop look (mobile's copy of
 * web's components/overview/PopOverview.tsx). Callers render them only
 * when useUiLook().pop.
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
export function OnPaceCard({ streak, dailyPace }: { streak: number; dailyPace: number }) {
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
  const sticker = useSticker();
  const ink = colors["on-marigold"]!;
  const next = 5 - (streak % 5);
  const line =
    streak === 0
      ? `Yesterday went over your ${formatCents(dailyPace)} daily pace. Today's a fresh start.`
      : `${streak === 1 ? "Day" : "Days"} in a row under your ${formatCents(dailyPace)} daily pace.${streak < 15 ? ` ${next === 1 ? "One more closes" : `${next} more close`} the next five.` : ""}`;
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/transactions")}
      className="rounded-card border-card border-ink p-5 gap-3 active:opacity-90"
      style={[{ backgroundColor: colors.marigold }, sticker]}
      accessibilityRole="button"
      accessibilityLabel={`On-pace days: ${streak}. ${line}`}
    >
      <Text className="font-ui-semibold" style={{ color: ink, fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>On-pace days</Text>
      <View className="flex-row items-center gap-4" style={{ minHeight: 44 }}>
        <TallyMarks count={streak} height={44} color={ink} accent={colors["marigold-accent"]!} />
        <Text className="font-display" style={{ color: ink, fontSize: rf(48), lineHeight: rf(52), fontVariant: ["tabular-nums"] }}>{streak}</Text>
      </View>
      <Text className="font-ui-medium" style={{ color: ink, fontSize: rf(14.5), lineHeight: rf(20) }}>{line}</Text>
    </Pressable>
  );
}
