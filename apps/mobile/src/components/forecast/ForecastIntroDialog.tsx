import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { TrendingDown } from "lucide-react-native";
import { TallyDialog } from "@/components/ui/TallyDialog";
import { apiPost } from "@/lib/api";
import type { AccountProfile } from "@/lib/queries/account";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Mobile's one-time announcement of Forecast (web's ForecastIntroModal):
 * once per account (POST /api/announcements/seen "forecast"), and only when
 * the account hasn't chosen classic. "Not now" just closes -- the More sheet
 * row and Overview's card stay, so dismissing never loses the way in.
 */
export function ForecastIntroDialog({ profile, show }: { profile: AccountProfile | undefined; show: boolean }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Older servers don't send the list: never show rather than nag.
    if (done || !show || !profile?.seenAnnouncements) return;
    if (!profile.seenAnnouncements.includes("forecast") && profile.uiLook !== "classic") setVisible(true);
  }, [profile, show, done]);

  function dismiss(open = false) {
    setVisible(false);
    setDone(true);
    apiPost("/api/announcements/seen", { key: "forecast" }).catch(() => {});
    if (open) router.push("/forecast" as Href);
  }

  const points = [
    "Tally plots your balance day by day from your pay dates, bills and card statements.",
    "It leads with the first day you'd drop below your buffer — and what put you there.",
    "Day-to-day spending is the one estimate, so it's drawn as a range.",
  ];

  return (
    <TallyDialog
      visible={visible}
      onClose={() => dismiss()}
      tone="brand"
      icon={<TrendingDown size={20} color={colors.brand} strokeWidth={2} />}
      title="New: Forecast"
      subtitle="See where your balance is heading for the next 60 days."
      actions={[
        { label: "See the forecast", variant: "primary", onPress: () => dismiss(true) },
        { label: "Not now", variant: "secondary", onPress: () => dismiss() },
      ]}
    >
      <View className="gap-2">
        {points.map((p) => (
          <Text key={p} className="font-ui text-text" style={{ fontSize: rf(14.5), lineHeight: rf(21) }}>
            • {p}
          </Text>
        ))}
      </View>
    </TallyDialog>
  );
}
