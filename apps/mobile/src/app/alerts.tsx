import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { PieChart, Receipt, Repeat, Landmark, type LucideIcon } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { useAlertHistory, useAlertPreferences, useUpdateAlertPreferences, type AlertHistoryItem, type AlertType } from "@/lib/queries/alerts";

// Native port of apps/web/components/settings/AlertSettings.tsx: same API,
// same wording. Email is the only channel.
const TYPES: { type: AlertType; label: string; description: string; icon: LucideIcon }[] = [
  { type: "budget_threshold", label: "Budgets", description: "When a budget reaches 80% and 100% this month.", icon: PieChart },
  { type: "large_transaction", label: "Large purchases", description: "When a charge is over your threshold, or about 3× what you usually spend there.", icon: Receipt },
  { type: "subscription_change", label: "Subscriptions", description: "When a new subscription appears or one gets more expensive.", icon: Repeat },
  { type: "connection_broken", label: "Connections", description: "When a bank needs you to sign in again.", icon: Landmark },
];
const ICON_BY_TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t.icon])) as Record<AlertType, LucideIcon>;

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function HistoryRow({ alert, isLast }: { alert: AlertHistoryItem; isLast: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const Icon = ICON_BY_TYPE[alert.type];
  const failed = alert.email?.status === "failed";
  return (
    <View className="flex-row items-start gap-3 py-3.5" style={!isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}>
      <Icon size={17} color={colors["text-3"]} strokeWidth={1.75} style={{ marginTop: 2 }} />
      <View className="flex-1 gap-0.5 min-w-0">
        <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>{alert.title}</Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>{alert.body}</Text>
        {failed && (
          <Text className="font-ui text-negative" style={{ fontSize: rf(12) }}>
            Email didn&apos;t send: {alert.email!.error}
          </Text>
        )}
      </View>
      <View className="items-end gap-1">
        <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{relativeTime(alert.createdAt)}</Text>
        {alert.email && (
          <Text
            className={`font-ui-medium px-1.5 py-0.5 rounded overflow-hidden ${failed ? "bg-negative-subtle text-negative" : "bg-sunken text-text-2"}`}
            style={{ fontSize: rf(11) }}
          >
            {failed ? "Email failed" : "Emailed"}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const prefs = useAlertPreferences();
  const history = useAlertHistory(20);
  const update = useUpdateAlertPreferences();

  const [threshold, setThreshold] = useState("");
  const [thresholdMsg, setThresholdMsg] = useState<string | null>(null);
  useEffect(() => {
    if (prefs.data) setThreshold(String(prefs.data.largeTransactionCents / 100));
  }, [prefs.data?.largeTransactionCents]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveThreshold() {
    const cents = Math.round(Number(threshold) * 100);
    if (!Number.isFinite(cents) || cents < 1_000 || cents > 10_000_000) {
      setThresholdMsg("Enter an amount from $10 to $100,000.");
      return;
    }
    if (cents === prefs.data?.largeTransactionCents) return;
    try {
      await update.mutateAsync({ largeTransactionCents: cents });
      setThresholdMsg("Saved");
    } catch {
      setThresholdMsg("Couldn't save. Try again.");
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-canvas" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}
      >
        <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(13.5) }}>
          Tally emails you when something needs a look. Each alert is sent once.
        </Text>

        {prefs.isLoading || !prefs.data ? (
          <ActivityIndicator className="mt-4" />
        ) : (
          <>
            <Card className="px-5">
              {TYPES.map(({ type, label, description, icon: Icon }, i) => (
                <View
                  key={type}
                  className="flex-row items-center gap-3 py-4"
                  style={i < TYPES.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
                >
                  <Icon size={18} color={colors["text-2"]} strokeWidth={1.75} />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>{label}</Text>
                    <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>{description}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={`Email ${label.toLowerCase()} alerts`}
                    value={prefs.data!.channels[type].email}
                    onValueChange={(email) => update.mutate({ channels: { [type]: { email } } })}
                    trackColor={{ false: colors["border-strong"], true: colors.brand }}
                    ios_backgroundColor={colors["border-strong"]}
                  />
                </View>
              ))}
            </Card>

            <Card className="p-5 gap-2">
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1 gap-0.5">
                  <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>Large purchase threshold</Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>Any single charge at or above this alerts.</Text>
                </View>
                <View className="flex-row items-center h-11 rounded-control bg-surface-2 px-3" style={{ borderWidth: 1, borderColor: colors["border-strong"] }}>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(15) }}>$</Text>
                  <TextInput
                    value={threshold}
                    onChangeText={(t) => {
                      setThreshold(t.replace(/[^\d.]/g, ""));
                      setThresholdMsg(null);
                    }}
                    onBlur={saveThreshold}
                    onSubmitEditing={saveThreshold}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    accessibilityLabel="Large purchase threshold in dollars"
                    className="font-ui text-text text-right"
                    style={{ fontSize: rf(15), minWidth: 72, paddingLeft: 4, fontVariant: ["tabular-nums"] }}
                  />
                </View>
              </View>
              {thresholdMsg && (
                <Text className={`font-ui self-end ${thresholdMsg === "Saved" ? "text-text-3" : "text-negative"}`} style={{ fontSize: rf(12) }}>
                  {thresholdMsg}
                </Text>
              )}
            </Card>
          </>
        )}

        <View className="gap-3">
          <Text className="font-ui-semibold text-text-2 px-1" style={{ textTransform: "uppercase", fontSize: rf(13) }}>Recent alerts</Text>
          {history.isLoading ? (
            <ActivityIndicator />
          ) : (history.data?.alerts.length ?? 0) === 0 ? (
            <Text className="font-ui text-text-3 px-1" style={{ fontSize: rf(13) }}>No alerts yet. They&apos;ll show up here as they&apos;re sent.</Text>
          ) : (
            <Card className="px-5">
              {history.data!.alerts.map((a, i, arr) => (
                <HistoryRow key={a.id} alert={a} isLast={i === arr.length - 1} />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
