import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { Ellipsis, Eye, EyeOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { MeterBar } from "@/components/ui/MeterBar";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useAccounts } from "@/lib/queries/accounts";
import { TabHeader, SyncFreshness, hasSynced } from "@/components/ui/TabHeader";
import { useOverview, useNetWorthTrend } from "@/lib/queries/overview";
import { useTransactions } from "@/lib/queries/transactions";
import { useCashFlowTrend } from "@/lib/queries/cashflow";
import { useLiabilities } from "@/lib/queries/liabilities";
import { useHoldings } from "@/lib/queries/investments";
import { useCategoryBreakdown } from "@/lib/queries/spendBreakdown";
import { CategorySpendBar } from "@/components/charts/CategorySpendBar";
import { NetWorthHero } from "@/components/overview/NetWorthHero";
import { AttentionStack } from "@/components/overview/AttentionStack";
import { MonthCard } from "@/components/overview/MonthCard";
import { StatPair } from "@/components/overview/StatPair";
import { UpcomingList } from "@/components/overview/UpcomingList";
import { RecentList } from "@/components/overview/RecentList";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useDismissUndo } from "@/lib/useDismissUndo";
import { Toast } from "@/components/ui/Toast";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { highCardCount, rankBudgets } from "@tally/core/overviewView";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { useUiLook } from "@/lib/UiLookContext";
import { HeroSurface, OnPaceCard } from "@/components/overview/PopOverview";
import { SafeToSpendCard } from "@/components/overview/SafeToSpend";
import { useSafeToSpend } from "@/lib/queries/safeToSpend";
import { GoalCard } from "@/components/overview/GoalCard";
import { GoalIntroDialog } from "@/components/overview/GoalIntroDialog";
import { NewLookDialog } from "@/components/overview/NewLookDialog";
import { useAccountProfile } from "@/lib/queries/account";
import { useGoal } from "@/lib/queries/goals";
import { monthSummary } from "@tally/core/budgetView";
import { greetingFor, leftToSpendLine } from "@tally/core/popView";
import { featuredReviewYear } from "@tally/core/yearReview";
import { formatCents } from "@tally/core/money";

// MOBILE_DESIGN.md §5.2 -- hero net worth (unboxed, direct on canvas), what
// needs a tap (banks, review backlog), "This month", Investments / Credit
// used, "Budget this month" (the three most-used), "Upcoming", "Recent
// activity" and "Where it went."
export default function OverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const rf = useRF();
  const { pop } = useUiLook();
  const goal = useGoal(pop);
  const safe = useSafeToSpend(pop);
  // ?safe=1 from an alert email (via the web's /open and +native-intent) opens the breakdown.
  const params = useLocalSearchParams<{ safe?: string }>();
  const profile = useAccountProfile();
  // One dialog per visit: the new-look announcement first, the goals intro
  // after (an older server sends no list -- nothing to wait for).
  const lookSeen = profile.data ? (profile.data.seenAnnouncements?.includes("new-look") ?? true) : false;
  const accounts = useAccounts();
  const overview = useOverview();
  const trend = useNetWorthTrend();
  const recent = useTransactions();
  const cashFlow = useCashFlowTrend(2);
  const liabilities = useLiabilities();
  const holdings = useHoldings();
  const breakdown = useCategoryBreakdown();
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  // True while a finger is on the net worth chart: locks the outer ScrollView
  // (its scrollEnabled prop below) so a vertical wobble mid-drag can't hand
  // the touch to the scroll view instead of the chart.
  const [isScrubbingChart, setIsScrubbingChart] = useState(false);
  const undo = useDismissUndo();

  const netCents = accounts.data?.totals.net ?? 0;

  const recentItems = recent.data?.pages[0]?.items.slice(0, 5) ?? [];
  const topBudgets = rankBudgets(overview.data?.budgets.categories ?? [], 3);

  const months = cashFlow.data?.months ?? [];
  const currentMonth = months[months.length - 1];
  const priorMonth = months.length > 1 ? months[months.length - 2] : undefined;

  const totalBudgeted = overview.data?.budgets.totalBudgeted ?? 0;
  const investmentsCents = holdings.data && holdings.data.holdings.length > 0 ? holdings.data.value : null;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Tally Pop: a greeting with what's left to spend (@tally/core/popView).
  const popTitle = `${greetingFor(now.getHours())} Here's ${now.toLocaleDateString("en-US", { month: "long" })}.`;
  const popLine = overview.data
    ? leftToSpendLine(monthSummary(overview.data.budgets.categories, { phase: "current", daysElapsed: now.getDate(), daysInMonth }), (c) => formatCents(c))
    : null;
  const onPace = overview.data?.onPace ?? null;

  const refreshing = accounts.isFetching || overview.isFetching || trend.isFetching;
  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["networth-trend"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    queryClient.invalidateQueries({ queryKey: ["investments"] });
    queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
    queryClient.invalidateQueries({ queryKey: ["goal"] });
    queryClient.invalidateQueries({ queryKey: ["safe-to-spend"] });
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 + tabBarClearance }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        // A finger landing on the chart still has to win the touch responder
        // race against this ScrollView's own pan gesture -- without this,
        // that race is what made scrubbing feel unreliable (a vertical
        // wobble mid-drag could hand the touch to the scroll view instead
        // of the chart). scrollEnabled is flipped off at onPanResponderGrant
        // (NetWorthHero's PanResponder) and back on at release/terminate,
        // removing the ScrollView from contention entirely for the
        // duration of a scrub instead of relying on gesture arbitration.
        scrollEnabled={!isScrubbingChart}
      >
        <View className="px-5 pb-1">
          {/* Year in review, all year: this year so far, last year's in January. */}
          {(() => {
            const { year, inProgress } = featuredReviewYear(new Date().toISOString().slice(0, 10));
            return (
              <Pressable
                onPress={() => router.push(`/year-in-review?year=${year}` as Href)}
                className="flex-row items-center gap-2.5 rounded-full mb-3 active:opacity-90"
                style={{ backgroundColor: colors.marigold ?? colors["warning-subtle"], borderWidth: 2, borderColor: colors.ink ?? colors["border-strong"], paddingVertical: 7, paddingLeft: 14, paddingRight: 7 }}
                accessibilityRole="button"
                accessibilityLabel={`Your ${year}${inProgress ? " so far" : ""}: see your year in review`}
              >
                <Text className="font-display" style={{ fontSize: rf(18), color: colors["on-marigold"] ?? colors.text }}>&apos;{String(year).slice(2)}</Text>
                <Text className="font-ui-semibold flex-1" style={{ fontSize: rf(14), color: colors["on-marigold"] ?? colors.text }} numberOfLines={1}>
                  {inProgress ? "Your year so far is ready" : `Your ${year} is ready`}
                </Text>
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: colors.ink ?? colors.text }}>
                  <Text className="font-ui-semibold" style={{ fontSize: rf(12.5), color: colors.marigold ?? colors.canvas }}>See it</Text>
                </View>
              </Pressable>
            );
          })()}
          <TabHeader
            title={pop ? popTitle : "Overview"}
            meta={[
              pop ? popLine : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
              hasSynced(accounts.data?.institutions.map((i) => i.lastSyncedAt) ?? []) && <SyncFreshness key="sync" syncedAt={accounts.data?.institutions.map((i) => i.lastSyncedAt) ?? []} />,
            ]}
            actions={
              <View className="flex-row items-center gap-4">
          <Pressable onPress={togglePrivacy} hitSlop={12} accessibilityRole="switch" accessibilityLabel="Hide sensitive amounts" accessibilityState={{ checked: hidden }}>
            {hidden ? <EyeOff size={20} color={colors["text-2"]} strokeWidth={1.75} /> : <Eye size={20} color={colors["text-2"]} strokeWidth={1.75} />}
          </Pressable>
          <Pressable onPress={() => router.push("/more")} hitSlop={12}>
            <Ellipsis size={22} color={colors["text-2"]} strokeWidth={1.75} />
          </Pressable>
              </View>
            }
          />
        </View>

      <View className="gap-7 px-5 pt-3">
        {/* Hero net worth -- unboxed, per MOBILE_DESIGN.md */}
        {pop ? (
          <HeroSurface>
            <NetWorthHero netCents={netCents} points={trend.data?.points ?? []} loading={accounts.isLoading} onScrubChange={setIsScrubbingChart} />
          </HeroSurface>
        ) : (
          <NetWorthHero netCents={netCents} points={trend.data?.points ?? []} loading={accounts.isLoading} onScrubChange={setIsScrubbingChart} />
        )}

        {/* Tally Pop: safe to spend over a compact on-pace row (the streak needs a budget to pace against) */}
        {pop && ((safe.data?.cash.length ?? 0) > 0 || onPace) && (
          <View className="gap-3.5">
            {safe.data && safe.data.cash.length > 0 && <SafeToSpendCard s={safe.data} initiallyOpen={params.safe === "1"} />}
            {onPace && <OnPaceCard streak={onPace.streak} dailyPace={onPace.dailyPace} compact={(safe.data?.cash.length ?? 0) > 0} />}
          </View>
        )}

        {/* Tally Pop: the year-end goal, or a prompt to set one */}
        {pop && <GoalCard summary={goal.data} />}

        {/* Banks that need a tap and this month's review backlog (the same count as
            the Transactions tab's "N to review" banner) -- renders nothing when all
            is well; sync freshness already sits in the header meta line. */}
        <AttentionStack institutions={accounts.data?.institutions ?? []} unreviewed={recent.data?.pages[0]?.summary?.unreviewed ?? 0} />

        {/* This month: spend against budget, income, saved -- with Investments and Credit used tucked just beneath */}
        <View className="gap-3">
          {currentMonth && (
            <MonthCard
              spend={currentMonth.spend}
              income={currentMonth.income}
              priorIncome={priorMonth?.income}
              totalBudgeted={totalBudgeted}
              daysElapsed={now.getDate()}
              daysInMonth={daysInMonth}
            />
          )}
          <StatPair investmentsCents={investmentsCents} credit={liabilities.data?.utilization ?? null} highCards={highCardCount(liabilities.data?.cards ?? [])} />
        </View>

        {/* Budget this month */}
        {topBudgets.length > 0 && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Budget this month</Text>
              <Pressable onPress={() => router.push("/(tabs)/budgets")}>
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
              </Pressable>
            </View>
            <Card className="p-5 gap-5">
              {topBudgets.map((b) => (
                <MeterBar key={b.categoryId} label={b.categoryName} colorSlot={b.colorSlot ?? b.categoryColorSlot} spentCents={b.spend} budgetCents={b.amount + b.rolloverFromPrior} mask={false} />
              ))}
            </Card>
          </View>
        )}

        {/* Upcoming */}
        <UpcomingList bills={overview.data?.upcomingBills ?? []} onDismissed={undo.onDismissed} />

        {/* Recent activity */}
        <RecentList items={recentItems} />

        {/* Where it went -- analysis rather than action, so it closes the screen */}
        {(breakdown.data?.rows.length ?? 0) > 0 && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Where it went</Text>
              <Pressable onPress={() => router.push("/(tabs)/transactions")} hitSlop={8}>
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
              </Pressable>
            </View>
            <Card className="p-5">
              <CategorySpendBar rows={breakdown.data!.rows} />
            </Card>
          </View>
        )}
      </View>
      </ScrollView>
      <Toast message={undo.message} onHidden={undo.clear} action={undo.action} bottom={tabBarClearance + 16} />
      <NewLookDialog profile={profile.data} />
      {pop && lookSeen && <GoalIntroDialog summary={goal.data} />}
    </View>
  );
}
