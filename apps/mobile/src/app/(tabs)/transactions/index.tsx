import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListFilter, Plus, RefreshCw, Search, X } from "lucide-react-native";
import { prettifyPfc } from "@tally/core/pfc";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransactions, type TransactionRow } from "@/lib/queries/transactions";
import { useAccounts } from "@/lib/queries/accounts";
import { TabHeader, SyncFreshness, hasSynced } from "@/components/ui/TabHeader";
import { useSync } from "@/lib/queries/plaid";
import { amountColor } from "@/lib/amountColor";
import { TransactionFiltersSheet, type TransactionFilters } from "@/components/TransactionFiltersSheet";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyPeriodIllustration } from "@/components/transactions/EmptyPeriodIllustration";

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Matches web's TransactionsList.tsx: only an amortized installment's label
// ends in "(n/total)" (see recurringBillGeneration.ts's labelFor) -- a
// manual-bill backfill posts at its plain description/merchant name instead.
const AMORTIZED_INSTALLMENT_RE = /\(\d+\/\d+\)$/;
function isAmortizedInstallment(name: string): boolean {
  return AMORTIZED_INSTALLMENT_RE.test(name);
}

// MOBILE_DESIGN.md §5.3 -- card list (not a table), infinite scroll, filter
// pill instead of a sticky multi-field bar. Swipe-to-categorize is still
// deferred past this first cut; the filter sheet itself is wired below.
//
// Rows carry their own bg-surface and round only their first/last corners
// (rather than wrapping the whole FlatList in one rounded/overflow-hidden
// View) so the list reads as a single Card the same way Budget's meter list
// does, while the title above stays outside it on plain canvas -- matching
// Budget's "title outside, content boxed below" layout instead of a card
// that swallows the header too.
function TransactionRowItem({ item, isFirst, isLast, colors }: { item: TransactionRow; isFirst: boolean; isLast: boolean; colors: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const rf = useRF();
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      className="flex-row items-center justify-between bg-surface py-4 px-5"
      style={[
        !isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined,
        isFirst ? { borderTopLeftRadius: 18, borderTopRightRadius: 18 } : undefined,
        isLast ? { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 } : undefined,
      ]}
    >
      <View className="gap-0.5 flex-1 pr-3">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>
          {item.merchantName ?? item.name}
        </Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }} numberOfLines={1}>
          {item.categoryName ?? prettifyPfc(item.pfcDetailed)}
          {item.isPending ? " · Pending" : ""}
          {item.isManual && isAmortizedInstallment(item.merchantName ?? item.name) ? " · Spread" : ""}
          {item.excludedFromBudget ? " · Excluded" : ""}
        </Text>
      </View>
      <MoneyText
        cents={item.amount}
        signed
        mask={false}
        className="font-ui-medium"
        style={{ color: amountColor(item.amount, colors), fontStyle: item.isPending ? "italic" : "normal", fontSize: rf(15) }}
      />
    </Pressable>
  );
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const colors = useThemeColors();
  const rf = useRF();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const sync = useSync();
  // Budgets' "View transactions" deep-links here with a category + the
  // viewed month's range (router.push params), same as web's
  // /transactions?category=…&from=…&to=… link. This has to be a useEffect,
  // not a useState initializer -- expo-router keeps this tab's screen
  // mounted once you've visited it, so a second "View transactions" tap
  // (any category, any month) only ever updates deepLink's values on an
  // already-mounted component; a useState initializer runs once per mount
  // and would silently ignore every deep link after the first.
  const deepLink = useLocalSearchParams<{ category?: string; from?: string; to?: string }>();
  const [filters, setFilters] = useState<TransactionFilters>({});
  useEffect(() => {
    if (deepLink.category) setFilters({ category: deepLink.category, from: deepLink.from, to: deepLink.to });
  }, [deepLink.category, deepLink.from, deepLink.to]);

  // Matches web's transactions page search box: the input updates instantly
  // (searchInput) so typing never feels laggy, but the actual query
  // (searchQuery, what drives queryFilters/react-query below) waits for a
  // 400ms pause so it's not re-fetching on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setSearchQuery(value.trim()), 400);
  }
  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

  const queryFilters = useMemo(() => {
    const out: Record<string, string> = {};
    if (searchQuery) out.q = searchQuery;
    if (filters.account?.length) out.account = filters.account.join(",");
    if (filters.pending) out.pending = filters.pending;
    if (filters.from) out.from = filters.from;
    if (filters.to) out.to = filters.to;
    if (filters.category) {
      // Mirrors web's BudgetRow.tsx link exactly: a category deep-link always
      // excludes transfers and budget-excluded rows too, not just the category.
      out.category = filters.category;
      out.transfer = "0";
      out.excluded = "0";
    }
    return out;
  }, [filters, searchQuery]);
  // -2 when a category deep-link is active: transfer/excluded ride along
  // automatically (see queryFilters above) and shouldn't inflate the badge
  // as if they were separately chosen. Search isn't counted here -- it has
  // its own visible input, same as web doesn't fold search into its Filters count.
  const activeCount = Object.keys(queryFilters).length - (filters.category ? 2 : 0) - (searchQuery ? 1 : 0);
  const hasAnyFilter = activeCount > 0 || Boolean(searchQuery);

  // The sheet's own "Clear all" only ever touched `filters` -- it had
  // nothing to do with `searchQuery`/`searchInput` before those existed on
  // this screen, so it silently stopped fully clearing once search shipped.
  // Also backs the inline "Clear filters" pill below, the only way to drop
  // a deep-linked category+month filter without opening the sheet at all.
  function clearAllFilters() {
    setFilters({});
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    setSearchInput("");
    setSearchQuery("");
  }

  const { data: accountsData } = useAccounts();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useTransactions(queryFilters);

  // Matches web's transactions page (SyncButton products={["transactions"]})
  // -- syncs every item's transactions, not just balances, since this is the
  // one screen where a stale row (a pending charge that's since posted, a
  // merchant name Plaid only fills in after settlement) is the whole point.
  async function handleSync() {
    try {
      const res = await sync.mutateAsync(["transactions"]);
      const failed = res.results.filter((r) => r.failures.length > 0);
      if (failed.length > 0) {
        Alert.alert(
          "Some accounts didn't sync",
          failed.map((f) => `${f.institutionName ?? "An account"}: ${f.failures.map((x) => x.label).join(", ")}`).join("\n"),
        );
      }
    } catch {
      Alert.alert("Sync failed", "Please try again in a moment.");
    }
  }

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  // Headline: spend for the period/filters on screen, from the API's summary
  // (absent on a server older than this build -- the figure just hides).
  const firstPage = data?.pages[0];
  const summary = firstPage?.summary;
  const total = firstPage?.pagination.total ?? 0;
  const periodLabel = firstPage
    ? firstPage.dateRange.isExplicit
      ? "in this range"
      : `in ${new Date(firstPage.dateRange.from + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}`
    : "";
  const syncTimes = accountsData?.institutions.map((i) => i.lastSyncedAt) ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <ScreenGlow />

      {/* No wrapping View for card chrome, and no className on the FlatList itself -- NativeWind's
          FlatList binding uses remapProps (not cssInterop), which silently drops className-driven
          margin/rounding/background set there. Horizontal/top/bottom insets instead come from
          contentContainerStyle (a literal style object, unaffected by that bug) -- the same 20px
          side inset Budget gets from its `px-5` wrapper, applied uniformly to the title and the
          row list below it so both line up exactly like Overview/Accounts/Budgets. */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TransactionRowItem item={item} isFirst={index === 0} isLast={index === items.length - 1} colors={colors} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24 + tabBarClearance }}
        onEndReachedThreshold={0.4}
        onEndReached={() => hasNextPage && fetchNextPage()}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View className="pb-4">
            <TabHeader
              eyebrow="Your money"
              title="Transactions"
              figure={summary ? <MoneyText cents={summary.spend} mask={false} className="font-display text-text" style={{ fontSize: rf(36), lineHeight: rf(40) }} /> : undefined}
              figureContext={
                summary
                  ? `spent across ${total} transaction${total === 1 ? "" : "s"} ${periodLabel}${summary.unreviewed > 0 ? ` · ${summary.unreviewed} to review` : ""}`
                  : undefined
              }
              meta={[hasSynced(syncTimes) && <SyncFreshness key="sync" syncedAt={syncTimes} />]}
              actions={
                <>
                <Pressable onPress={() => setAddOpen(true)} hitSlop={12} className="items-center justify-center rounded-full bg-brand" style={{ width: 34, height: 34 }}>
                  <Plus size={18} color={colors["on-brand"]} strokeWidth={2.3} />
                </Pressable>
                <Pressable
                  onPress={handleSync}
                  disabled={sync.isPending}
                  hitSlop={12}
                  accessibilityLabel="Sync transactions"
                  className="items-center justify-center rounded-full bg-brand-subtle disabled:opacity-50"
                  style={{ width: 34, height: 34 }}
                >
                  {sync.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : <RefreshCw size={15} color={colors.brand} strokeWidth={2} />}
                </Pressable>
                <Pressable onPress={() => setFiltersOpen(true)} className="flex-row items-center gap-2 rounded-full px-4 py-2.5 bg-brand-subtle">
                  <ListFilter size={14} color={colors.brand} strokeWidth={1.9} />
                  <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>Filters</Text>
                  {activeCount > 0 && (
                    <View className="rounded-full items-center justify-center bg-brand" style={{ minWidth: 18, height: 18, paddingHorizontal: 4 }}>
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(11) }}>{activeCount}</Text>
                    </View>
                  )}
                </Pressable>
                </>
              }
            />

            <View className="flex-row items-center gap-2 rounded-control bg-surface-2 px-3.5 mt-3" style={{ height: 42 }}>
              <Search size={16} color={colors["text-3"]} strokeWidth={2} />
              <TextInput
                value={searchInput}
                onChangeText={handleSearchChange}
                placeholder="Search merchant or description"
                placeholderTextColor={colors["text-3"]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                className="flex-1 font-ui text-text"
                style={{ fontSize: rf(14.5), paddingVertical: 0 }}
              />
              {searchInput.length > 0 && (
                <Pressable
                  onPress={() => {
                    if (searchDebounce.current) clearTimeout(searchDebounce.current);
                    setSearchInput("");
                    setSearchQuery("");
                  }}
                  hitSlop={8}
                >
                  <X size={15} color={colors["text-3"]} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {/* Deep-linked category/date filters (Budgets' "View transactions") have no
                other visible trace on this screen -- without this, the only way to
                discover you're filtered at all, let alone clear it, was opening the
                Filters sheet and finding "Clear all" at the bottom of it. */}
            {activeCount > 0 && (
              <View className="flex-row items-center justify-between mt-2.5 px-1">
                <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
                  {activeCount} filter{activeCount === 1 ? "" : "s"} applied
                </Text>
                <Pressable onPress={clearAllFilters} hitSlop={8}>
                  <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(12.5) }}>Clear filters</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="mt-8" />
          ) : activeCount === 0 && !searchQuery ? (
            <View className="rounded-card bg-surface p-8 mt-2">
              <EmptyState
                illustration={<EmptyPeriodIllustration />}
                title={`No transactions in ${currentMonthLabel()}`}
                description="Nothing's posted yet this month."
              />
            </View>
          ) : (
            <Text className="font-ui text-text-3 rounded-card bg-surface p-6" style={{ fontSize: rf(14) }}>No transactions match these filters.</Text>
          )
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
      />

      <TransactionFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={setFilters}
        onClearAll={clearAllFilters}
      />
      <AddTransactionSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
