import { ActivityIndicator, Text, View } from "react-native";
import { CalendarCheck } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { CADENCE_LABEL } from "@tally/core/paycheque";
import { Card } from "@/components/ui/Card";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useSafeToSpend } from "@/lib/queries/safeToSpend";

function payday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The paycheque Tally found in synced deposits (GET /api/safe-to-spend's
 * `paycheque`), as on web's Settings → Income: the next date and amount
 * once the last three landed on time, otherwise why there isn't one yet.
 * Shown on the Income and Safe to spend screens.
 */
export function NextPaychequeCard() {
  const colors = useThemeColors();
  const rf = useRF();
  const { hidden } = usePrivacy();
  const safe = useSafeToSpend();
  const p = safe.data?.paycheque ?? null;
  return (
    <Card className="p-5 flex-row items-start gap-3.5">
      <View className="items-center justify-center rounded-control" style={{ width: 40, height: 40, backgroundColor: colors["positive-subtle"], borderWidth: 2, borderColor: colors.ink ?? colors.border }}>
        <CalendarCheck size={20} color={colors.positive} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-semibold" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase", color: p?.confident ? colors.positive : colors["text-3"] }}>Next paycheque</Text>
        {safe.isLoading ? (
          <ActivityIndicator style={{ alignSelf: "flex-start" }} />
        ) : p?.confident ? (
          <>
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>
              {payday(p.nextDate)} · about {hidden ? "••••••" : formatCents(Math.round(p.amount / 100) * 100)}
            </Text>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>From {p.label} · {CADENCE_LABEL[p.cadence]} · the last 3 landed on time</Text>
          </>
        ) : p ? (
          <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>Your pay from {p.label} hasn&apos;t landed on a steady schedule lately. Until it does, payday comes from your income schedule, or the end of the month.</Text>
        ) : (
          <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>No steady paycheque found yet. Set your pay&apos;s category to Income and turn on &quot;Always use&quot;. After three paydays, Tally predicts the next one.</Text>
        )}
      </View>
    </Card>
  );
}
