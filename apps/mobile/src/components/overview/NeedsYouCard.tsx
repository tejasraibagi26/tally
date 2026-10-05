import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { connectionState, type ConnectionState } from "@/lib/connectionState";
import type { Institution } from "@/lib/queries/accounts";
import { MoneyText } from "@/components/ui/MoneyText";
import { StateButton, toneColor } from "@/components/accounts/InstitutionCard";
import { hairline, withAlpha } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

const MAX_ROWS = 2;
// Overview has no in-flight sync or Plaid Link of its own: those live on the
// Accounts tab, which is where every action here goes.
const IDLE = { refreshing: false, linking: false, justReconnected: false, refreshFailed: false };

export type NeedsYouItem = { institution: Institution; state: ConnectionState };

/** Banks that need a tap, most urgent first. */
export function useNeedsYouItems(institutions: Institution[]): NeedsYouItem[] {
  return useMemo(
    () =>
      institutions
        .map((institution) => ({ institution, state: connectionState(institution, IDLE) }))
        .filter((c) => c.state.needsAttention)
        .sort((a, b) => a.state.rank - b.state.rank || (a.institution.institutionName ?? "").localeCompare(b.institution.institutionName ?? "")),
    [institutions],
  );
}

/**
 * Banks that need a tap, only when there are any: icon, title and a written
 * reason always accompany the tone color. Every row and button opens the
 * Accounts tab's Fix sheet, where Plaid Link and the retry actions already live.
 */
export function NeedsYouCard({ items }: { items: NeedsYouItem[] }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  if (items.length === 0) return null;

  const blocked = items.some((c) => c.state.level === "blocked");
  const soonOnly = items.every((c) => c.institution.status === "pending_expiration");
  const tone = blocked ? "negative" : "warning";
  const affected = items.reduce((sum, c) => sum + c.institution.accounts.reduce((s, a) => s + Math.abs(a.currentBalance ?? 0), 0), 0);
  const title = `${items.length} bank${items.length === 1 ? "" : "s"} ${soonOnly ? "will need" : items.length === 1 ? "needs" : "need"} you${soonOnly ? " soon" : ""}`;
  const openFix = () => router.push({ pathname: "/(tabs)/accounts", params: { fix: String(Date.now()) } });
  const shown = items.slice(0, MAX_ROWS);

  return (
    <View className="rounded-card px-[18px] pt-4 pb-3.5" style={{ backgroundColor: colors[`${tone}-subtle`] }}>
      <Pressable onPress={openFix} className="flex-row items-center gap-2" accessibilityRole="button" accessibilityLabel={title}>
        <TriangleAlert size={16} color={colors[tone]} strokeWidth={2} />
        <Text className="font-ui-semibold flex-1" style={{ fontSize: rf(14.5), color: colors[tone] }} numberOfLines={1}>{title}</Text>
        {affected > 0 && (
          <Text className="font-ui text-text-2" style={{ fontSize: rf(12) }}>
            <MoneyText cents={affected} className="font-ui text-text-2" style={{ fontSize: rf(12) }} /> affected
          </Text>
        )}
      </Pressable>
      {shown.map(({ institution, state }) => {
        const name = institution.institutionName ?? "Unknown institution";
        const reason = state.notice?.title ?? state.statusLine;
        return (
          <View key={institution.id} className="flex-row items-center gap-3 mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
            <View className="w-[30px] h-[30px] rounded-[9px] items-center justify-center" style={{ backgroundColor: withAlpha(colors.text!, 0.08) }}>
              <Text className="font-ui-semibold" style={{ fontSize: rf(12), color: toneColor(colors, state.tone) }}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            {/* One line each, so a long bank name can't push the row to four lines; the label keeps the full text for screen readers. */}
            <Pressable onPress={openFix} className="flex-1 gap-0.5 min-w-0" accessibilityRole="button" accessibilityLabel={`${name}, ${reason}`}>
              <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{name}</Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(12) }} numberOfLines={1}>{reason}</Text>
            </Pressable>
            {state.action && <StateButton action={state.action} tone={state.tone} onPress={openFix} compact />}
          </View>
        );
      })}
      {items.length > MAX_ROWS && (
        <Pressable onPress={openFix} className="mt-3 pt-3 items-center" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }} accessibilityRole="button">
          <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: colors[tone] }}>View all {items.length}</Text>
        </Pressable>
      )}
    </View>
  );
}
