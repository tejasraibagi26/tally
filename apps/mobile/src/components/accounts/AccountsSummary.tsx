import { View, Text, Pressable } from "react-native";
import { ChevronRight, X } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { withAlpha } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Net worth, assets and debts across every account, from the totals
 * /api/accounts already returns (converted to the user's base currency) --
 * "what am I worth" before "which bank". Abbreviated so three columns fit a
 * phone at any balance size.
 */
export function AccountsSummary({ net, assets, liabilities }: { net: number; assets: number; liabilities: number }) {
  return (
    <Card className="flex-row px-5 py-4">
      <Figure label="Net worth" cents={net} />
      <Figure label="Assets" cents={assets} />
      <Figure label="Debts" cents={-liabilities} tone="text-negative" />
    </Card>
  );
}

// One size for all three so labels and figures share baselines across the
// row. Debts read in the negative color, matching web's Liabilities figure.
function Figure({ label, cents, tone = "text-text" }: { label: string; cents: number; tone?: string }) {
  const rf = useRF();
  return (
    <View className="flex-1 gap-1">
      <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{label}</Text>
      <MoneyText cents={cents} abbreviate className={`font-ui-semibold ${tone}`} style={{ fontSize: rf(16) }} numberOfLines={1} />
    </View>
  );
}

/**
 * Screen-level strip (blocked = coral, act-soon only = amber) counting every
 * connection that needs a tap. Opens the Fix sheet, so several broken banks
 * can be fixed from one list instead of hunting card by card.
 */
export function AttentionStrip({ count, blockedNames, onPress }: { count: number; blockedNames: string[]; onPress: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const blocked = blockedNames.length > 0;
  const accent = blocked ? colors.negative : colors.warning;
  const detail = blocked
    ? blockedNames.length === 1
      ? `Syncing is paused for ${blockedNames[0]}`
      : `Syncing is paused for ${blockedNames.length} banks`
    : "Fix it now so syncing doesn't stop";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-[14px] px-4 py-3 active:opacity-80"
      style={{ backgroundColor: blocked ? colors["negative-subtle"] : colors["warning-subtle"], borderWidth: 1, borderColor: withAlpha(accent, 0.25) }}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-semibold" style={{ color: accent, fontSize: rf(13.5) }}>
          {count} bank{count === 1 ? " needs" : "s need"} you
        </Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(12) }} numberOfLines={1}>{detail}</Text>
      </View>
      <View className="flex-row items-center">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(13) }}>Fix</Text>
        <ChevronRight size={15} color={colors.text} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

/**
 * A persistent, dismissible banner -- MOBILE_DESIGN.md's toast rule: sync
 * completion is a toast, but a failure stays on screen until it's read.
 */
export function SyncBanner({ tone, title, body, onDismiss }: { tone: "warning" | "negative"; title: string; body?: string; onDismiss?: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const accent = colors[tone]!;
  return (
    <View
      className="flex-row items-start gap-3 rounded-[14px] pl-4 pr-3 py-3"
      style={{ backgroundColor: colors[`${tone}-subtle`], borderWidth: 1, borderColor: withAlpha(accent, 0.25) }}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-semibold" style={{ color: accent, fontSize: rf(13.5) }}>{title}</Text>
        {body && <Text className="font-ui text-text-2" style={{ fontSize: rf(12), lineHeight: rf(16.5) }}>{body}</Text>}
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss">
          <X size={16} color={colors["text-3"]} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
}
