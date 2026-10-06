import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { formatCents, formatPercent } from "@tally/core/money";
import { creditHealth } from "@tally/core/overviewView";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { CardTile } from "@/components/cards/CardTile";
import { useLiabilities } from "@/lib/queries/liabilities";
import { cardRows, nextPayment, shortDate, type CardRowData } from "@/lib/cards";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";

/**
 * Credit cards (new in app 1.27.0, the web page's mobile twin): what you
 * owe, the next payment as one sentence, then one flat table of cards
 * sorted by what needs you. Each card's paid / due / overdue state comes
 * from @tally/core/cardView via GET /api/liabilities, counting payments
 * found in the card's own transactions since its statement closed.
 */
export default function CardsScreen() {
  const router = useRouter();
  const rf = useRF();
  const colors = useThemeColors();
  const contentTop = useScreenContentTop();
  const queryClient = useQueryClient();
  const { hidden } = usePrivacy();
  const { data, isLoading, isError, refetch, isRefetching } = useLiabilities();
  const rows = cardRows(data?.cards ?? [], data?.institutions);
  const next = nextPayment(rows);
  const owed = rows.reduce((s, r) => s + Math.max(0, r.card.currentBalance), 0);
  const util = data?.utilization;
  const health = util?.utilization != null ? creditHealth(util.utilization) : null;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 18, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
              queryClient.invalidateQueries({ queryKey: ["overview"] });
            }}
            tintColor={colors.brand}
          />
        }
      >
        {isError ? (
          <View className="rounded-card bg-surface p-5 items-center gap-2">
            <Text className="font-ui text-text" style={{ fontSize: rf(14) }}>Couldn't load your cards</Text>
            <Pressable onPress={() => refetch()} hitSlop={8}>
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>Retry</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <View className="gap-3" accessibilityLabel="Loading cards">
            <Skeleton style={{ width: 140, height: 11 }} />
            <Skeleton style={{ width: 200, height: 40 }} />
            <Skeleton style={{ width: 240, height: 12 }} />
            <Skeleton style={{ height: 210, borderRadius: 18, marginTop: 8 }} />
          </View>
        ) : rows.length === 0 ? (
          <View className="rounded-card bg-surface px-5 py-7 items-center gap-2">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15.5) }}>No credit cards yet</Text>
            <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
              Connect a card and its balance, statement and due date show up here.
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/accounts")} className="mt-2 h-10 px-5 rounded-full bg-brand items-center justify-center">
              <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Connect a card</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="gap-1.5">
              <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>
                You owe across {rows.length} card{rows.length === 1 ? "" : "s"}
              </Text>
              <Text className="font-display text-text" style={{ fontSize: rf(40), lineHeight: rf(44), fontVariant: ["tabular-nums"] }}>
                {hidden ? "$•••••" : formatCents(owed)}
              </Text>
              {util?.utilization != null && health && (
                <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                  {formatPercent(util.utilization)} of your limits used ·{" "}
                  <Text style={{ color: health.tone === "warning" ? colors.warning : colors.positive }}>{health.label}</Text>
                </Text>
              )}
            </View>

            <NextLine next={next} hidden={hidden} />

            <View className="rounded-card bg-surface overflow-hidden">
              {rows.map((r, i) => (
                <CardRow key={r.card.accountId} row={r} first={i === 0} hidden={hidden} onPress={() => router.push(`/card/${r.card.accountId}` as Href)} />
              ))}
            </View>

            <Text className="font-ui text-text-3 px-1" style={{ fontSize: rf(12), lineHeight: rf(17) }}>
              Statement details come from your bank once a day. Payments show up as soon as their transaction syncs.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** The next payment in one sentence: amber within 3 days, coral when overdue, green when all paid. */
function NextLine({ next, hidden }: { next: CardRowData | null; hidden: boolean }) {
  const rf = useRF();
  const colors = useThemeColors();
  if (!next) {
    return (
      <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
        <Text className="font-ui-semibold" style={{ color: colors.positive }}>All statements paid.</Text> Nothing due until your next statements close.
      </Text>
    );
  }
  const v = next.view;
  const tone = v.state === "overdue" ? colors.negative : v.state === "dueSoon" ? colors.warning : colors.text;
  const amount = v.amountDue != null ? formatCents(v.amountDue) : v.left != null ? formatCents(v.left) : null;
  // "is overdue", "due in 2 days", "due tomorrow", "due Thu, Oct 15".
  const when =
    v.state === "overdue" ? "is overdue" : v.state === "dueSoon" && v.dueLabel ? v.dueLabel.toLowerCase() : next.dueDate ? `due ${shortDate(next.dueDate)}` : "due";
  return (
    <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
      <Text className="font-ui-semibold" style={{ color: tone }}>
        Next: {hidden || !amount ? "a payment" : amount} {when}.
      </Text>{" "}
      {next.displayName}
      {next.card.mask ? ` ••${next.card.mask}` : ""}
      {v.amountDue == null ? ". Your bank doesn't report a minimum." : "."}
    </Text>
  );
}

function CardRow({ row, first, hidden, onPress }: { row: CardRowData; first: boolean; hidden: boolean; onPress: () => void }) {
  const rf = useRF();
  const colors = useThemeColors();
  const v = row.view;
  const c = row.card;
  const paid = v.state === "paid";
  const status =
    paid ? { text: c.currentBalance < 0 ? "✓ You have a credit" : "✓ Paid in full", color: colors.positive }
    : v.state === "overdue" ? { text: v.dueLabel ?? "Overdue", color: colors.negative }
    : v.state === "dueSoon" ? { text: v.dueLabel ?? "Due soon", color: colors.warning }
    : v.state === "noStatement" ? { text: "No statement yet", color: colors["text-3"] }
    : { text: `${v.paid > 0 && v.left != null && !hidden ? `${formatCents(v.left)} left · ` : ""}${v.dueLabel ?? ""}`, color: colors["text-3"] };
  const barColor = v.utilizationTone === "over" ? colors.negative : v.utilizationTone === "high" ? colors.warning : colors.brand;
  const right =
    v.utilization == null ? "No limit" : v.utilizationTone === "over" ? "Over limit" : `${formatPercent(v.utilization)}${v.utilizationTone === "high" ? " · High" : ""}`;
  return (
    <Pressable
      onPress={onPress}
      className="px-4 active:opacity-70"
      style={{ paddingVertical: 13, borderTopWidth: first ? 0 : 1, borderTopColor: hairline(colors), opacity: row.needsFix ? 0.7 : 1 }}
      accessibilityRole="button"
      accessibilityLabel={`${row.displayName}, ${hidden ? "" : `${formatCents(c.currentBalance)}, `}${status.text}`}
    >
      <View className="flex-row items-center gap-3">
        <CardTile bankName={row.bankName} color={row.color} logo={row.logo} network={c.network} />
        <View className="flex-1 min-w-0">
          <Text className={paid ? "font-ui-medium text-text-2" : "font-ui-semibold text-text"} style={{ fontSize: rf(14.5) }} numberOfLines={1}>{row.displayName}</Text>
          <Text className="font-ui" style={{ fontSize: rf(12), color: row.needsFix ? colors.negative : status.color, marginTop: 2 }} numberOfLines={1}>
            {c.mask ? `••${c.mask} · ` : ""}
            {row.needsFix ? "Reconnect on Accounts" : status.text}
          </Text>
        </View>
        <View className="items-end">
          <Text className={paid ? "font-ui-medium" : "font-ui-semibold"} style={{ fontSize: rf(15), fontVariant: ["tabular-nums"], color: c.currentBalance < 0 ? colors.positive : paid ? colors["text-2"] : colors.text }}>
            {hidden ? "•••••" : c.currentBalance < 0 ? `${formatCents(-c.currentBalance)}` : formatCents(c.currentBalance)}
          </Text>
          <Text className="font-ui" style={{ fontSize: rf(12), marginTop: 2, color: v.utilizationTone === "high" ? colors.warning : v.utilizationTone === "over" ? colors.negative : colors["text-3"] }}>{right}</Text>
        </View>
        <ChevronRight size={15} color={colors["text-3"]} />
      </View>
      {v.utilization != null && (
        <View style={{ marginLeft: 56, marginRight: 27, marginTop: 9, height: 4, borderRadius: 2, backgroundColor: colors.sunken }}>
          <View style={{ width: `${Math.min(1, Math.max(0, v.utilization)) * 100}%`, height: 4, borderRadius: 2, backgroundColor: barColor }} />
          <View style={{ position: "absolute", left: "30%", top: -2, bottom: -2, width: 1.5, backgroundColor: colors.text, opacity: 0.4 }} />
        </View>
      )}
    </Pressable>
  );
}
