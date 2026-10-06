import { useRef } from "react";
import { MerchantAvatar } from "@/components/transactions/MerchantAvatar";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { RefreshCw } from "lucide-react-native";
import { prettifyPfc } from "@tally/core/pfc";
import { DEFAULT_CURRENCY } from "@tally/core/fx";
import { describeTransactionRow } from "@tally/core/transactionView";
import { MoneyText } from "@/components/ui/MoneyText";
import type { TransactionRow } from "@/lib/queries/transactions";
import { chartSeries, hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { useColorScheme } from "nativewind";

/**
 * One transaction in the day-grouped list: review dot, one status mark
 * (@tally/core/transactionView), a category chip that opens the picker,
 * and swipe-left actions (Category, Reviewed).
 */
export function TransactionListRow({
  item,
  showTopBorder,
  onPickCategory,
  onMarkReviewed,
}: {
  item: TransactionRow;
  showTopBorder: boolean;
  onPickCategory: () => void;
  onMarkReviewed: () => void;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const swipe = useRef<SwipeableMethods>(null);
  const v = describeTransactionRow(
    {
      amount: item.amount,
      isPending: item.isPending,
      isTransfer: item.isTransfer ?? false,
      excludedFromBudget: item.excludedFromBudget,
      isManual: item.isManual,
      source: item.source ?? null,
      name: item.name,
      merchantName: item.merchantName,
      categoryId: item.categoryId,
      categoryKind: item.categoryKind ?? null,
      categorySource: item.categorySource ?? "plaid",
      splitCount: item.splits.length,
      recurringStreamId: item.recurringStreamId,
      reviewed: item.reviewed,
      currency: item.currency,
    },
    DEFAULT_CURRENCY,
  );
  const display = item.merchantName ?? item.name;
  const amountColor = v.amountTone === "positive" ? colors.positive : v.amountTone === "muted" ? colors["text-3"] : colors.text;
  const catColor = item.categoryColorSlot ? series[(item.categoryColorSlot - 1) % series.length] : colors["text-3"];

  function action(label: string, bg: string, fg: string, run: () => void) {
    return (
      <Pressable
        onPress={() => {
          swipe.current?.close();
          run();
        }}
        className="items-center justify-center"
        style={{ width: 76, backgroundColor: bg }}
        accessibilityLabel={label}
      >
        <Text className="font-ui-semibold" style={{ color: fg, fontSize: rf(12) }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <View className="flex-row">
          {!item.isTransfer && action("Category", colors.brand!, colors["on-brand"]!, onPickCategory)}
          {!item.reviewed && action("Reviewed", colors["surface-2"]!, colors.text!, onMarkReviewed)}
        </View>
      )}
    >
      <Pressable
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
        className="flex-row items-center gap-3 bg-surface px-4 py-3"
        style={showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
      >
        <MerchantAvatar name={display} logoUrl={item.isTransfer || item.isManual ? null : item.logoUrl} size={30} radius={9} fontSize={12} />
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            {v.needsReview && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} accessibilityLabel="Needs review" />}
            {v.recurring && <RefreshCw size={11} color={colors["text-3"]} />}
            <Text className="font-ui-medium flex-shrink" style={{ fontSize: rf(14.5), color: v.amountTone === "muted" ? colors["text-2"] : colors.text }} numberOfLines={1}>
              {display}
            </Text>
            {v.mark?.kind === "pending" ? (
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors["warning-subtle"] }}>
                <Text className="font-ui-medium" style={{ fontSize: rf(10.5), color: colors.warning }}>Pending</Text>
              </View>
            ) : v.mark ? (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>{`· ${v.mark.text}`}</Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            {item.isTransfer ? (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>Not counted in spend</Text>
            ) : (
              <Pressable
                onPress={onPickCategory}
                hitSlop={6}
                className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5"
                style={v.uncategorized ? { borderWidth: 1, borderStyle: "dashed", borderColor: colors.warning } : { backgroundColor: colors["surface-2"] }}
                accessibilityLabel={v.uncategorized ? "Choose category" : `Category ${item.categoryName ?? ""}, change`}
              >
                {!v.uncategorized && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: catColor }} />}
                <Text className="font-ui" style={{ fontSize: rf(11.5), color: v.uncategorized ? colors.warning : colors["text-2"] }} numberOfLines={1}>
                  {v.uncategorized ? "Choose category" : (item.categoryName ?? prettifyPfc(item.pfcDetailed))}
                </Text>
              </Pressable>
            )}
            {item.accountName && (
              <Text className="font-ui text-text-3 flex-shrink" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
                {item.accountName}
              </Text>
            )}
          </View>
        </View>
        <MoneyText
          cents={item.amount}
          signed
          mask={false}
          className="font-ui-semibold"
          style={{ color: amountColor, fontSize: rf(14.5), textDecorationLine: v.struck ? "line-through" : "none" }}
        />
      </Pressable>
    </ReanimatedSwipeable>
  );
}
