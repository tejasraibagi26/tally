import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListFilter, Plus } from "lucide-react-native";
import { prettifyPfc } from "@tally/core/pfc";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransactions, type TransactionRow } from "@/lib/queries/transactions";
import { amountColor } from "@/lib/amountColor";
import { TransactionFiltersSheet, type TransactionFilters } from "@/components/TransactionFiltersSheet";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";

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
  const [filters, setFilters] = useState<TransactionFilters>({});

  const queryFilters = useMemo(() => {
    const out: Record<string, string> = {};
    if (filters.account) out.account = filters.account;
    if (filters.pending) out.pending = filters.pending;
    if (filters.from) out.from = filters.from;
    if (filters.to) out.to = filters.to;
    return out;
  }, [filters]);
  const activeCount = Object.keys(queryFilters).length;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useTransactions(queryFilters);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

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
            <View className="flex-row items-center justify-between">
              <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(24) }}>
                Transactions
              </Text>
              <View className="flex-row items-center gap-2">
                <Pressable onPress={() => setAddOpen(true)} hitSlop={12} className="items-center justify-center rounded-full bg-brand" style={{ width: 34, height: 34 }}>
                  <Plus size={18} color={colors["on-brand"]} strokeWidth={2.3} />
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
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="mt-8" />
          ) : (
            <Text className="font-ui text-text-3 rounded-card bg-surface p-6" style={{ fontSize: rf(14) }}>No transactions in this range.</Text>
          )
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
      />

      <TransactionFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onApply={setFilters} />
      <AddTransactionSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
