import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListFilter, Plus, RefreshCw, Search, X } from "lucide-react-native";
import { groupByDay } from "@tally/core/transactionView";
import { formatCents } from "@tally/core/money";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransactions, useBulkTransactions, type TransactionRow } from "@/lib/queries/transactions";
import { TransactionListRow } from "@/components/transactions/TransactionListRow";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { useAccounts } from "@/lib/queries/accounts";
import { TabHeader, SyncFreshness, hasSynced } from "@/components/ui/TabHeader";
import { useSync } from "@/lib/queries/plaid";
import { TransactionFiltersSheet, type TransactionFilters } from "@/components/TransactionFiltersSheet";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { SyncBanner } from "@/components/accounts/AccountsSummary";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyPeriodIllustration } from "@/components/transactions/EmptyPeriodIllustration";
import { BusyIcon } from "@/components/ui/BusyIcon";

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Matches web's TransactionsList.tsx: only an amortized installment's label
// ends in "(n/total)" (see recurringBillGeneration.ts's labelFor) -- a
// manual-bill backfill posts at its plain description/merchant name instead.
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Day-grouped list (one continuous table, a header band per day with that day's net), review entry
// point and "To review" filter, swipe actions and an inline category
// picker per row. Row wording comes from @tally/core/transactionView,
// shared with web.
export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const colors = useThemeColors();
  const rf = useRF();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [pickerFor, setPickerFor] = useState<TransactionRow | null>(null);
  const router = useRouter();
  const bulk = useBulkTransactions();
  const sync = useSync();
  // Budgets' "View transactions" deep-links here with a category + the
  // viewed month's range (router.push params), same as web's
  // /transactions?category=…&from=…&to=… link. This has to be a useEffect,
  // not a useState initializer -- expo-router keeps this tab's screen
  // mounted once you've visited it, so a second "View transactions" tap
  // (any category, any month) only ever updates deepLink's values on an
  // already-mounted component; a useState initializer runs once per mount
  // and would silently ignore every deep link after the first.
  const deepLink = useLocalSearchParams<{ category?: string; account?: string; from?: string; to?: string }>();
  const [filters, setFilters] = useState<TransactionFilters>({});
  useEffect(() => {
    if (deepLink.category) setFilters({ category: deepLink.category, from: deepLink.from, to: deepLink.to });
    // A card's "All N" (card/[id].tsx): that card's charges since its statement.
    else if (deepLink.account) setFilters({ account: [deepLink.account], from: deepLink.from, to: deepLink.to });
  }, [deepLink.category, deepLink.account, deepLink.from, deepLink.to]);

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
  const activeCount = Object.keys(queryFilters).length - (filters.category ? 2 : 0) - (searchQuery ? 1 : 0) - (reviewOnly ? 1 : 0);
  const hasAnyFilter = activeCount > 0 || Boolean(searchQuery);

  // The sheet's own "Clear all" only ever touched `filters` -- it had
  // nothing to do with `searchQuery`/`searchInput` before those existed on
  // this screen, so it silently stopped fully clearing once search shipped.
  // Also backs the inline "Clear filters" pill below, the only way to drop
  // a deep-linked category+month filter without opening the sheet at all.
  function clearAllFilters() {
    setFilters({});
    setReviewOnly(false);
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
  // A failure stays on screen until dismissed (MOBILE_DESIGN.md §5.5), the
  // same SyncBanner Accounts uses -- an alert was gone after one tap.
  const [syncBanner, setSyncBanner] = useState<{ title: string; body: string } | null>(null);
  async function handleSync() {
    setSyncBanner(null);
    try {
      const res = await sync.mutateAsync(["transactions"]);
      const failed = res.results.filter((r) => r.failures.length > 0);
      if (failed.length > 0) {
        setSyncBanner({
          title: "Some accounts didn't sync",
          body: `${failed.map((f) => `${f.institutionName ?? "A bank"}: ${f.failures.map((x) => x.label).join(", ")}`).join(". ")}. Tally will try again on the next sync.`,
        });
      }
    } catch {
      setSyncBanner({ title: "Sync didn't run", body: "Check your connection and tap sync to try again." });
    }
  }

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const groups = useMemo(
    () => groupByDay(items.map((t) => ({ ...t, isTransfer: t.isTransfer ?? false })), todayISO()),
    [items],
  );
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
        data={groups}
        keyExtractor={(g) => g.date}
        // One continuous table: each day is a slice of the same card, so only the
        // first slice rounds its top and the last its bottom, and the day header
        // is a band inside the table rather than the top of a separate card.
        renderItem={({ item: g, index }) => (
          <View
            className={`overflow-hidden bg-surface ${index === 0 ? "rounded-t-card" : ""} ${index === groups.length - 1 ? "rounded-b-card" : ""}`}
          >
            <View
              className="flex-row justify-between px-4 py-2 bg-sunken"
              style={index > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
            >
              <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>{g.label}</Text>
              <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(12), fontVariant: ["tabular-nums"] }}>{formatCents(g.net, { signed: true })}</Text>
            </View>
            {g.rows.map((t, i) => (
              <TransactionListRow
                key={t.id}
                item={t}
                showTopBorder={i > 0}
                onPickCategory={() => setPickerFor(t)}
                onMarkReviewed={() => bulk.mutate({ ids: [t.id], action: { type: "markReviewed" } })}
              />
            ))}
          </View>
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
              figureContext={summary ? `spent across ${total} transaction${total === 1 ? "" : "s"} ${periodLabel}` : undefined}
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
                  <BusyIcon busy={sync.isPending} color={colors.brand!} size={16}>
                    <RefreshCw size={15} color={colors.brand} strokeWidth={2} />
                  </BusyIcon>
                </Pressable>
                {/* Round like + and sync, so the three actions leave the title room
                    ("Tran…" when this was a text pill). The count badge sits on its corner. */}
                <Pressable
                  onPress={() => setFiltersOpen(true)}
                  hitSlop={12}
                  accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} applied` : "Filters"}
                  className="items-center justify-center rounded-full bg-brand-subtle"
                  style={{ width: 34, height: 34 }}
                >
                  <ListFilter size={16} color={colors.brand} strokeWidth={2} />
                  {activeCount > 0 && (
                    <View
                      className="absolute rounded-full items-center justify-center bg-brand"
                      style={{ top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderWidth: 2, borderColor: colors.canvas }}
                    >
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(10.5) }}>{activeCount}</Text>
                    </View>
                  )}
                </Pressable>
                </>
              }
            />

            {syncBanner && (
              <View className="mt-3">
                <SyncBanner tone="warning" title={syncBanner.title} body={syncBanner.body} onDismiss={() => setSyncBanner(null)} />
              </View>
            )}

            {summary && summary.unreviewed > 0 && !reviewOnly && (
              <View className="flex-row items-center gap-3 rounded-[14px] bg-brand-subtle pl-4 pr-3 py-3 mt-3" style={{ borderWidth: 1, borderColor: colors["brand-border"] }}>
                <View className="flex-1 gap-0.5">
                  <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>{summary.unreviewed} to review</Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(12) }}>Confirm categories one by one. Swipe to go fast.</Text>
                </View>
                <Pressable onPress={() => router.push("/(tabs)/transactions/review")} className="h-9 px-4 rounded-full items-center justify-center bg-brand">
                  <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(13) }}>Review</Text>
                </Pressable>
              </View>
            )}

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
            {(reviewOnly || (summary?.unreviewed ?? 0) > 0) && (
              <View className="flex-row mt-2.5">
                <Pressable
                  onPress={() => setReviewOnly((v) => !v)}
                  className="rounded-full px-3 py-1.5"
                  style={reviewOnly ? { backgroundColor: colors["brand-subtle"] } : { borderWidth: 1, borderColor: colors.border }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reviewOnly }}
                >
                  <Text className="font-ui-medium" style={{ fontSize: rf(12.5), color: reviewOnly ? colors.brand : colors.warning }}>
                    {reviewOnly ? "Only to review ✕" : `To review · ${summary?.unreviewed ?? 0}`}
                  </Text>
                </Pressable>
              </View>
            )}
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
      <CategoryPickerSheet
        visible={pickerFor != null}
        onClose={() => setPickerFor(null)}
        selectedId={pickerFor?.categoryId ?? null}
        includeUncategorized={false}
        onSelect={(categoryId) => {
          if (pickerFor && categoryId) bulk.mutate({ ids: [pickerFor.id], action: { type: "setCategory", categoryId } });
          setPickerFor(null);
        }}
      />
    </View>
  );
}
