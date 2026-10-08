import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronRight, RefreshCw, TrendingUp } from "lucide-react-native";
import { BusyIcon } from "@/components/ui/BusyIcon";
import { formatCents, formatPercent } from "@tally/core/money";
import { allocationBy, summarizeRange, unrealizedGainTotal, describeInvestmentTxn, type AllocationView, type HistoryRange } from "@tally/core/investments";
import type { ConnectionAction } from "@tally/core/connectionState";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { PortfolioChart } from "@/components/charts/PortfolioChart";
import { PositionRow, ActivityItem, Segmented } from "@/components/investments/parts";
import { HoldingSheet } from "@/components/investments/HoldingSheet";
import { StateButton, toneColor, toneSubtle } from "@/components/accounts/InstitutionCard";
import { useRevokeDialog } from "@/components/accounts/RevokeDialog";
import { useInvestments, type StaleConnection } from "@/lib/useInvestments";
import { useSync, useRefreshItemBalances } from "@/lib/queries/plaid";
import { usePlaidLink } from "@/lib/usePlaidLink";
import { ago } from "@tally/core/connectionState";
import { chartSeries, withAlpha } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import { useThemeColors } from "@/theme/useThemeColors";
import { useColorScheme } from "nativewind";

const RANGES: { key: HistoryRange; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "YTD", label: "YTD" },
  { key: "1Y", label: "1Y" },
  { key: "ALL", label: "All" },
];
const RANGE_PHRASE: Record<HistoryRange, string> = { "1M": "past month", "3M": "past 3 months", YTD: "this year", "1Y": "past year", ALL: "since tracking began" };
const TOP_HOLDINGS = 5;
const TOP_ACTIVITY = 8;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Mobile counterpart of apps/web/app/(app)/investments/page.tsx: value over
// time first (with money-in under it), then money in vs. growth, allocation,
// top holdings, and recent activity in plain words. Shared math and wording
// live in @tally/core/investments.
export default function InvestmentsScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
  const contentTop = useScreenContentTop();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const sync = useSync();
  const { openLink, linkingItemId, isLinking, progressSheet } = usePlaidLink();
  const refresh = useRefreshItemBalances();
  const { confirmRevoke, revokeDialog } = useRevokeDialog();
  const data = useInvestments(linkingItemId);
  const today = todayISO();

  const [range, setRange] = useState<HistoryRange | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [allocView, setAllocView] = useState<AllocationView>("type");
  const [openId, setOpenId] = useState<string | null>(null);

  const syncAction = (
    <Pressable
      onPress={() => sync.mutate(["holdings", "investments"])}
      disabled={sync.isPending}
      hitSlop={10}
      accessibilityState={{ busy: sync.isPending }}
      className="flex-row items-center gap-1.5 px-2 py-1"
    >
      {/* The label stays and the spinner takes a fixed slot, so the header button never resizes. */}
      <BusyIcon busy={sync.isPending} color={colors.brand!} size={14}>
        <RefreshCw size={13} color={colors.brand} strokeWidth={2.2} />
      </BusyIcon>
      <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(15) }}>Sync</Text>
    </Pressable>
  );
  // Rendered by every branch below: the header options plus the overlays a
  // connection action can open (the Link progress sheet, the revoke dialog).
  // Plain brand text in the header's right slot; on iOS through
  // unstable_headerRightItems with hidesSharedBackground so iOS 26 doesn't
  // wrap it in Liquid Glass bar-button chrome.
  const screenChrome = (
    <>
      <Stack.Screen
        options={{
          headerRight: () => syncAction,
          unstable_headerRightItems: () => [{ type: "custom", element: syncAction, hidesSharedBackground: true }],
        }}
      />
      {progressSheet}
      {revokeDialog}
    </>
  );

  function runAction(c: StaleConnection, action: ConnectionAction) {
    if (action.kind === "signIn") void openLink("update", c.institution.id);
    else if (action.kind === "refresh") refresh.mutate(c.institution.id);
    else confirmRevoke(c.institution);
  }

  if (data.isLoading) {
    return (
      <View className="flex-1 bg-canvas px-5 gap-5" style={{ paddingTop: contentTop }}>
        {screenChrome}
        <ScreenGlow />
        <Card className="p-5 gap-3">
          <Skeleton style={{ height: 10, width: 100 }} />
          <Skeleton style={{ height: 32, width: 170 }} />
          <Skeleton style={{ height: 130 }} />
        </Card>
        <Card className="p-5 gap-3">
          <Skeleton style={{ height: 12, width: 140 }} />
          <Skeleton style={{ height: 12, width: 200 }} />
        </Card>
      </View>
    );
  }

  if (data.isError) {
    return (
      <View className="flex-1 bg-canvas px-5" style={{ paddingTop: contentTop }}>
        {screenChrome}
        <ScreenGlow />
        <Card className="px-5 py-6 gap-3 items-start">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{"Couldn't load your investments"}</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>Check your connection and try again.</Text>
          <Pressable onPress={() => data.refetch()} className="h-10 rounded-full items-center justify-center px-5 bg-brand-subtle mt-1">
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>Try again</Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  if (data.holdings.length === 0) {
    return (
      <View className="flex-1 bg-canvas px-5" style={{ paddingTop: contentTop }}>
        {screenChrome}
        <ScreenGlow />
        <Card className="px-5 pt-6 pb-5 gap-4">
          <View className="w-12 h-12 rounded-full items-center justify-center bg-brand-subtle">
            <TrendingUp size={22} color={colors.brand} strokeWidth={1.8} />
          </View>
          <View className="gap-1.5">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Track your investments</Text>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
              Connect a brokerage like Wealthsimple or Questrade to see your TFSA, RRSP and FHSA in one place, with growth over time.
            </Text>
          </View>
          <Pressable onPress={() => openLink("create")} disabled={isLinking} className="h-12 rounded-full flex-row items-center justify-center gap-2 bg-brand active:opacity-90">
            {isLinking && <ActivityIndicator size="small" color={colors["on-brand"]} />}
            <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14.5) }}>Connect a brokerage</Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  const history = data.history;
  const enough = history.length >= 2;
  const coveredFor = (r: HistoryRange) => summarizeRange(history, r, today).covered;
  const activeRange: HistoryRange = range ?? (["1Y", "YTD", "3M", "1M"] as HistoryRange[]).find(coveredFor) ?? "ALL";
  const summary = summarizeRange(history, activeRange, today);
  const scrubbed = scrubIndex != null ? summary.points[scrubIndex] : null;

  const last = history[history.length - 1];
  const invested = last?.invested ?? 0;
  const growth = data.value - invested;
  const unrealized = unrealizedGainTotal(data.positions);
  const slices = allocationBy(data.holdings, allocView);

  const yearStart = `${today.slice(0, 4)}-01-01`;
  const ytd = data.activity.filter((t) => t.date >= yearStart).map((t) => describeInvestmentTxn(t, (c) => formatCents(c)));
  const incomeYtd = ytd.filter((d) => d.filter === "income" && d.tone === "positive").reduce((s, d) => s + d.amount, 0);
  const addedYtd = ytd.filter((d) => d.filter === "deposits").reduce((s, d) => s + d.amount, 0);

  const open = data.positions.find((p) => p.securityId === openId) ?? null;
  const label = { fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" as const };

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      {screenChrome}
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        scrollEnabled={!scrubbing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.refetch()} tintColor={colors.brand} />}
      >
        {data.needsYou.map((c) => (
          <View
            key={c.institution.id}
            className="flex-row items-center gap-3 rounded-[14px] pl-4 pr-3 py-3"
            style={{ backgroundColor: toneSubtle(colors, c.state.tone), borderWidth: 1, borderColor: withAlpha(toneColor(colors, c.state.tone), 0.25) }}
          >
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-semibold" style={{ color: toneColor(colors, c.state.tone), fontSize: rf(13.5) }}>
                {c.institution.institutionName ?? "A bank"} · {c.state.notice?.title ?? c.state.statusLine}
              </Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
                {c.accountNames.join(" and ")} (<MoneyText cents={c.value} style={{ fontSize: rf(12.5) }} />) {c.accountNames.length === 1 ? "is" : "are"} as of {ago(c.institution.lastSyncedAt)}.
              </Text>
            </View>
            {c.state.action && <StateButton action={c.state.action} tone={c.state.tone} pending={c.state.actionPending} onPress={() => runAction(c, c.state.action!)} />}
          </View>
        ))}

        <Card className="overflow-hidden">
          <View className="px-5 pt-5 pb-3 gap-2">
            <Text className="font-ui-medium text-text-3" style={label}>
              {scrubbed ? new Date(`${scrubbed.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Portfolio value"}
            </Text>
            <MoneyText cents={scrubbed ? scrubbed.value : data.value} className="font-display text-text" style={{ fontSize: rf(36) }} />
            {enough &&
              (scrubbed ? (
                <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
                  Invested <MoneyText cents={scrubbed.invested} /> · growth{" "}
                  <MoneyText cents={scrubbed.value - scrubbed.invested} signed style={{ color: scrubbed.value < scrubbed.invested ? colors.negative : colors.positive }} />
                </Text>
              ) : (
                <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
                  <MoneyText cents={summary.growth} signed style={{ color: summary.growth < 0 ? colors.negative : colors.positive }} /> growth · <MoneyText cents={summary.added} signed /> added · {RANGE_PHRASE[activeRange]}
                </Text>
              ))}
            {enough ? (
              <>
                <PortfolioChart points={summary.points} onScrub={setScrubIndex} onScrubbingChange={setScrubbing} />
                <Segmented options={RANGES} value={activeRange} onChange={setRange} disabled={(r) => !coveredFor(r)} />
              </>
            ) : (
              <View className="h-[110px] rounded-[12px] bg-sunken items-center justify-center px-6">
                <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(12.5), lineHeight: rf(18) }}>
                  Your chart starts filling in tomorrow. Tally records your portfolio once a day.
                </Text>
              </View>
            )}
          </View>
          <View className="px-5 py-4 gap-3 border-t border-border">
            <View className="flex-row gap-4">
              <View className="flex-1 gap-1">
                <Text className="font-ui-medium text-text-3" style={label}>Invested</Text>
                {enough ? <MoneyText cents={invested} className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} /> : <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>After 2 days</Text>}
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-ui-medium text-text-3" style={label}>{enough ? "Growth" : "Unrealized gain"}</Text>
                {enough ? (
                  <Text className="font-ui-semibold" style={{ fontSize: rf(16), color: growth < 0 ? colors.negative : colors.positive }}>
                    <MoneyText cents={growth} signed className="font-ui-semibold" style={{ fontSize: rf(16), color: growth < 0 ? colors.negative : colors.positive }} />
                    {invested > 0 ? ` · ${formatPercent(Math.abs(growth / invested))}` : ""}
                  </Text>
                ) : unrealized.covered > 0 ? (
                  <MoneyText cents={unrealized.amount} signed className="font-ui-semibold" style={{ fontSize: rf(16), color: unrealized.amount < 0 ? colors.negative : colors.positive }} />
                ) : (
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>—</Text>
                )}
              </View>
            </View>
            {enough && invested > 0 && (
              <View className="flex-row h-2 rounded-full overflow-hidden" style={{ gap: 2 }}>
                <View style={{ flex: invested, backgroundColor: colors["text-3"] }} />
                {growth > 0 && <View style={{ flex: growth, backgroundColor: colors.positive }} />}
              </View>
            )}
          </View>
        </Card>

        <View className="flex-row items-center justify-between px-1">
          <Text className="font-ui-semibold text-text-3" style={label}>Allocation</Text>
          <Segmented options={[{ key: "type" as AllocationView, label: "Type" }, { key: "account" as AllocationView, label: "Account" }]} value={allocView} onChange={setAllocView} />
        </View>
        <Card className="p-5 gap-3.5">
          <View className="flex-row h-2.5 rounded-full overflow-hidden bg-sunken" style={{ gap: 2 }}>
            {slices.map((s, i) => (
              <View key={s.label} style={{ flex: s.value, backgroundColor: series[i % series.length] }} />
            ))}
          </View>
          {slices.map((s, i) => (
            <View key={s.label} className="flex-row items-center gap-2.5">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: series[i % series.length] }} />
              <Text className="font-ui text-text flex-1" style={{ fontSize: rf(13) }} numberOfLines={1}>{s.label}</Text>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>{formatPercent(s.pct)}</Text>
              <MoneyText cents={s.value} className="font-ui text-text-2" style={{ fontSize: rf(13), minWidth: 72, textAlign: "right" }} />
            </View>
          ))}
        </Card>

        <View className="flex-row items-center justify-between px-1">
          <Text className="font-ui-semibold text-text-3" style={label}>Holdings</Text>
          {data.positions.length > TOP_HOLDINGS && (
            <Pressable onPress={() => router.push("/investment-holdings")} hitSlop={8} className="flex-row items-center">
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>All {data.positions.length}</Text>
              <ChevronRight size={15} color={colors.brand} />
            </Pressable>
          )}
        </View>
        <Card className="overflow-hidden">
          {data.positions.slice(0, TOP_HOLDINGS).map((p, i) => {
            const note = data.staleNote(p);
            return (
              <PositionRow
                key={p.securityId}
                p={p}
                showTopBorder={i > 0}
                onPress={() => setOpenId(p.securityId)}
                dim={!!note && !note.partial}
                caption={note ? note.text : `${p.isCashEquivalent ? "Cash" : `${formatQuantityShort(p.quantity)} sh`} · ${p.lots.length > 1 ? `${p.lots.length} accounts` : p.lots[0]!.accountName}`}
                captionTone={note?.partial ? "negative" : undefined}
              />
            );
          })}
        </Card>

        {data.activity.length > 0 && (
          <>
            <Text className="font-ui-semibold text-text-3 px-1" style={label}>Recent activity</Text>
            <Card className="overflow-hidden">
              {data.activity.slice(0, TOP_ACTIVITY).map((tx, i) => (
                <ActivityItem key={tx.id} tx={tx} showTopBorder={i > 0} />
              ))}
            </Card>
            <Card className="flex-row px-5 py-4">
              <View className="flex-1 gap-1">
                <Text className="font-ui-medium text-text-3" style={label}>Income this year</Text>
                <Text className="font-ui-semibold text-positive" style={{ fontSize: rf(15), fontVariant: ["tabular-nums"] }}>{formatCents(incomeYtd, { signed: true })}</Text>
              </View>
              <View className="flex-1 gap-1 items-end">
                <Text className="font-ui-medium text-text-3" style={label}>Added this year</Text>
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15), fontVariant: ["tabular-nums"] }}>{formatCents(addedYtd, { signed: true })}</Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <HoldingSheet
        position={open}
        holding={open ? (data.holdings.find((h) => h.securityId === open.securityId) ?? null) : null}
        activity={open ? data.activity.filter((t) => t.securityId === open.securityId) : []}
        onClose={() => setOpenId(null)}
      />
    </View>
  );
}

function formatQuantityShort(q: number): string {
  return q >= 100 ? Math.round(q).toLocaleString() : Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
