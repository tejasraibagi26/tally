import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Landmark, Check } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** Shape-matched to the summary + two cards, so nothing jumps when data lands. */
export function AccountsSkeleton() {
  return (
    <View className="gap-5">
      <Card className="flex-row px-5 py-4 gap-4">
        {[72, 60, 54].map((w, i) => (
          <View key={i} className="flex-1 gap-2">
            <Skeleton style={{ height: 9, width: 44 }} />
            <Skeleton style={{ height: 15, width: w }} />
          </View>
        ))}
      </Card>
      {[3, 2].map((rows, c) => (
        <Card key={c} className="px-5 py-[18px] gap-4">
          <View className="flex-row items-center gap-3">
            <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />
            <View className="gap-1.5">
              <Skeleton style={{ height: 11, width: 140 }} />
              <Skeleton style={{ height: 9, width: 84 }} />
            </View>
          </View>
          {Array.from({ length: rows }).map((_, r) => (
            <View key={r} className="flex-row justify-between">
              <Skeleton style={{ height: 11, width: 96 - r * 14 }} />
              <Skeleton style={{ height: 11, width: 70 }} />
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

/** First run: what connecting does, why it's safe, and one button. */
export function ConnectFirstBank({ onConnect, connecting }: { onConnect: () => void; connecting: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Card className="px-5 pt-6 pb-5 gap-4">
      <View className="w-12 h-12 rounded-full items-center justify-center bg-brand-subtle">
        <Landmark size={22} color={colors.brand} strokeWidth={1.8} />
      </View>
      <View className="gap-1.5">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Connect your first bank</Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
          Tally reads your balances and transactions so budgets, bills and net worth fill themselves in.
        </Text>
      </View>
      <View className="gap-2">
        {["Read-only. Tally can't move money", "Secured by Plaid. Your password stays with your bank", "Disconnect any bank at any time"].map((t) => (
          <View key={t} className="flex-row items-center gap-2">
            <Check size={14} color={colors.brand} strokeWidth={2.5} />
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>{t}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={onConnect} disabled={connecting} className="h-12 rounded-full flex-row items-center justify-center gap-2 bg-brand active:opacity-90 mt-1">
        {connecting && <ActivityIndicator size="small" color={colors["on-brand"]} />}
        <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14.5) }}>Connect a bank</Text>
      </Pressable>
    </Card>
  );
}

/** No cached data and the request failed -- never a blank screen. */
export function AccountsLoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Card className="px-5 py-6 gap-3 items-start">
      <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{"Couldn't load your accounts"}</Text>
      <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>Check your connection and try again.</Text>
      <Pressable onPress={onRetry} disabled={retrying} className="h-10 rounded-full items-center justify-center px-5 bg-brand-subtle active:opacity-80 mt-1">
        {retrying ? <ActivityIndicator size="small" color={colors.brand} /> : <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>Try again</Text>}
      </Pressable>
    </Card>
  );
}
