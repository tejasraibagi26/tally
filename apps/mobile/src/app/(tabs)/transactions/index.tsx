import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListFilter } from "lucide-react-native";
import { prettifyPfc } from "@tally/core/pfc";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransactions, type TransactionRow } from "@/lib/queries/transactions";
import { amountColor } from "@/lib/amountColor";
import { TransactionFiltersSheet, type TransactionFilters } from "@/components/TransactionFiltersSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";

// MOBILE_DESIGN.md §5.3 -- card list (not a table), infinite scroll, filter
// pill instead of a sticky multi-field bar. Swipe-to-categorize is still
// deferred past this first cut; the filter sheet itself is wired below.
function TransactionRowItem({ item, isLast, colors }: { item: TransactionRow; isLast: boolean; colors: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const rf = useRF();
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      className="flex-row items-center justify-between py-4 px-5"
      style={!isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
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
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
      <ScreenGlow />
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(24) }}>
          Transactions
        </Text>
      </View>

      <View className="px-5 pb-4">
        <Pressable onPress={() => setFiltersOpen(true)} className="self-start flex-row items-center gap-2 rounded-full px-4 py-2.5 bg-brand-subtle">
          <ListFilter size={14} color={colors.brand} strokeWidth={1.9} />
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>Filters</Text>
          {activeCount > 0 && (
            <View className="rounded-full items-center justify-center bg-brand" style={{ minWidth: 18, height: 18, paddingHorizontal: 4 }}>
              <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(11) }}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <TransactionRowItem item={item} isLast={index === items.length - 1} colors={colors} />}
          className="mx-5 mb-5 rounded-card bg-surface"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 + tabBarClearance }}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasNextPage && fetchNextPage()}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<Text className="font-ui text-text-3 p-6" style={{ fontSize: rf(14) }}>No transactions in this range.</Text>}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
        />
      )}

      <TransactionFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onApply={setFilters} />
    </View>
  );
}
