import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, PanResponder, ActivityIndicator, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { formatCents } from "@tally/core/money";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { useReviewQueue, useReviewTransaction } from "@/lib/queries/transactions";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { useColorScheme } from "nativewind";

const SWIPE_DISTANCE = 110;

/**
 * Review queue, one card at a time. Swipe right (or tap the first button)
 * confirms the guess; swipe left (or "Other…") opens the category picker;
 * Skip leaves it for later. "Always use … for <merchant>" makes the pick a
 * rule via PATCH /api/transactions/:id alwaysCategorizeMerchant.
 */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const { data, isLoading, isError } = useReviewQueue();
  const review = useReviewTransaction();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const [always, setAlways] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [x] = useState(() => new Animated.Value(0));

  const items = data?.items ?? [];
  const current = items[index];
  const total = items.length;

  function next() {
    setIndex((i) => i + 1);
    setAlways(false);
    x.setValue(0);
  }

  function resolve(categoryId: string | null) {
    if (!current) return;
    setError(null);
    review.mutate(
      { id: current.id, categoryId, always: always && !!current.merchantName },
      {
        onSuccess: () => {
          setDone((d) => d + 1);
          next();
        },
        onError: () => {
          setError("Couldn't save that one. Try again.");
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      },
    );
  }

  function finish() {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    router.back();
  }

  const swipeRef = useRef<((dir: "confirm" | "other") => void) | null>(null);
  // eslint-disable-next-line react-hooks/refs -- swipeRef is only read inside gesture handlers, at event time.
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => x.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_DISTANCE) {
          Animated.timing(x, { toValue: 500, duration: 160, useNativeDriver: true }).start(() => swipeRef.current?.("confirm"));
        } else if (g.dx < -SWIPE_DISTANCE) {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
          swipeRef.current?.("other");
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  );
  // The responder is created once; it calls the latest handlers through this ref.
  useEffect(() => {
    swipeRef.current = (dir) => {
      if (dir === "confirm") {
        const first = current?.suggestions[0];
        if (first) resolve(first.categoryId);
        else {
          x.setValue(0);
          setPicking(true);
        }
      } else setPicking(true);
    };
  });

  const rotate = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ["-8deg", "0deg", "8deg"] });

  return (
    <View className="flex-1 bg-sunken" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
      <View className="flex-row items-center justify-between px-5 py-2">
        <Pressable onPress={finish} hitSlop={10}>
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(15) }}>Done</Text>
        </Pressable>
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }}>{current ? `${index + 1} of ${total}` : "Review"}</Text>
        <Pressable onPress={next} disabled={!current} hitSlop={10}>
          <Text className="font-ui-semibold" style={{ fontSize: rf(15), color: current ? colors.brand : colors["text-3"] }}>Skip</Text>
        </Pressable>
      </View>
      {total > 0 && (
        <View className="mx-5 my-2 h-1 rounded-full bg-surface-2 overflow-hidden">
          <View className="h-full bg-brand" style={{ width: `${(Math.min(index, total) / total) * 100}%` }} />
        </View>
      )}

      <View className="flex-1 justify-center px-5">
        {isLoading ? (
          <ActivityIndicator />
        ) : isError ? (
          <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(14) }}>{"Couldn't load transactions to review."}</Text>
        ) : !current ? (
          <View className="items-center gap-3">
            <Text className="font-display text-text text-center" style={{ fontSize: rf(28) }}>{"You're all caught up"}</Text>
            <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(14) }}>
              {done > 0 ? `${done} reviewed. New transactions show up here as they sync.` : "Nothing left to review."}
            </Text>
            <Pressable onPress={finish} className="mt-2 h-11 px-6 rounded-full items-center justify-center bg-brand">
              <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: x }, { rotate }] }} className="rounded-[20px] bg-surface p-5 gap-4">
            <View className="flex-row justify-between items-start gap-4">
              <View className="flex-1 gap-1">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }} numberOfLines={2}>{current.merchantName ?? current.name}</Text>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>
                  {new Date(`${current.postedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {current.accountName}
                  {current.isPending ? " · pending" : ""}
                </Text>
              </View>
              <Text className="font-ui-semibold" style={{ fontSize: rf(20), color: current.amount > 0 ? colors.positive : colors.text, fontVariant: ["tabular-nums"] }}>
                {formatCents(current.amount, { signed: true })}
              </Text>
            </View>
            {current.suggestions.length > 0 && (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{current.suggestions[0]!.reason === "current" ? "Tally's guess" : "You've used"}</Text>
            )}
            <View className="gap-2">
              {current.suggestions[0] && (
                <Pressable onPress={() => resolve(current.suggestions[0]!.categoryId)} disabled={review.isPending} className="h-12 rounded-full flex-row items-center justify-center gap-2 bg-brand">
                  {review.isPending ? (
                    <ActivityIndicator color={colors["on-brand"]} />
                  ) : (
                    <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14.5) }}>✓ {current.suggestions[0].name}</Text>
                  )}
                </Pressable>
              )}
              <View className="flex-row gap-2">
                {current.suggestions.slice(1).map((s) => (
                  <Pressable key={s.categoryId} onPress={() => resolve(s.categoryId)} disabled={review.isPending} className="flex-1 h-10 rounded-full flex-row items-center justify-center gap-1.5 bg-brand-subtle">
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: series[(s.colorSlot - 1) % series.length] }} />
                    <Text className="font-ui-medium text-brand" style={{ fontSize: rf(13) }} numberOfLines={1}>{s.name}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setPicking(true)} className="flex-1 h-10 rounded-full items-center justify-center" style={{ borderWidth: 1, borderColor: colors.border }}>
                  <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>{current.suggestions.length ? "Other…" : "Choose category"}</Text>
                </Pressable>
              </View>
            </View>
            {current.merchantName && (
              <View className="flex-row items-center justify-between gap-3">
                <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(13) }}>Always use my pick for {current.merchantName}</Text>
                <Switch value={always} onValueChange={setAlways} trackColor={{ true: colors.brand, false: colors["surface-2"] }} />
              </View>
            )}
            {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>{error}</Text>}
            <Pressable onPress={() => resolve(null)} disabled={review.isPending} className="items-center">
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>Looks right, mark reviewed</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {current && (
        <View className="flex-row justify-between px-6">
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>← swipe: other category</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>swipe: confirm →</Text>
        </View>
      )}

      <CategoryPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        selectedId={current?.categoryId ?? null}
        includeUncategorized={false}
        onSelect={(categoryId) => {
          setPicking(false);
          if (categoryId) resolve(categoryId);
        }}
      />
    </View>
  );
}
