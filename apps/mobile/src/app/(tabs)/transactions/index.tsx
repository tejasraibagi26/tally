import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListFilter } from "lucide-react-native";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransactions, type TransactionRow } from "@/lib/queries/transactions";
import { amountColor } from "@/lib/amountColor";
import { TransactionFiltersSheet, type TransactionFilters } from "@/components/TransactionFiltersSheet";

// MOBILE_DESIGN.md §5.3 -- card list (not a table), infinite scroll, filter
// pill instead of a sticky multi-field bar. Swipe-to-categorize is still
// deferred past this first cut; the filter sheet itself is wired below.
function TransactionRowItem({ item, isLast }: { item: TransactionRow; isLast: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      className="flex-row items-center justify-between py-4 px-5"
      style={!isLast ? { borderBottomWidth: 1, borderBottomColor: "rgba(228,225,217,0.55)" } : undefined}
    >
      <View className="gap-0.5 flex-1 pr-3">
        <Text className="font-ui-semibold text-[15px] text-text" numberOfLines={1}>
          {item.merchantName ?? item.name}
        </Text>
        <Text className="font-ui text-[12.5px] text-text-2" numberOfLines={1}>
          {item.pfcDetailed ?? "Uncategorized"}
          {item.isPending ? " · Pending" : ""}
        </Text>
      </View>
      <MoneyText cents={item.amount} signed className="text-[15px] font-ui-medium" style={{ color: amountColor(item.amount), fontStyle: item.isPending ? "italic" : "normal" }} />
    </Pressable>
  );
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
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
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-[24px] text-text" style={{ letterSpacing: -0.3 }}>
          Transactions
        </Text>
      </View>

      <View className="px-5 pb-4">
        <Pressable onPress={() => setFiltersOpen(true)} className="self-start flex-row items-center gap-2 rounded-full px-4 py-2.5" style={{ backgroundColor: "#E6EFEA" }}>
          <ListFilter size={14} color="#14513F" strokeWidth={1.9} />
          <Text className="font-ui-semibold text-[13.5px]" style={{ color: "#14513F" }}>
            Filters
          </Text>
          {activeCount > 0 && (
            <View className="rounded-full items-center justify-center" style={{ backgroundColor: "#14513F", minWidth: 18, height: 18, paddingHorizontal: 4 }}>
              <Text className="font-ui-semibold text-[11px] text-on-brand">{activeCount}</Text>
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
          renderItem={({ item, index }) => <TransactionRowItem item={item} isLast={index === items.length - 1} />}
          className="mx-5 rounded-card bg-surface"
          style={{ shadowColor: "#1A1917", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasNextPage && fetchNextPage()}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<Text className="font-ui text-[14px] text-text-3 p-6">No transactions in this range.</Text>}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
        />
      )}

      <TransactionFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onApply={setFilters} />
    </View>
  );
}
