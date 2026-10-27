import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react-native";
import { TallyDialog } from "@/components/ui/TallyDialog";
import { apiPost } from "@/lib/api";
import type { GoalSummary } from "@/lib/queries/goals";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Mobile's one-time year-end goals announcement (web's GoalIntroModal):
 * once per account, Tally Pop only (the caller checks), and not once a goal
 * exists. Either button records it (POST /api/goals/intro). "Not now" only
 * closes: Overview's "Set a goal for the year" card stays until there is one.
 */
export function GoalIntroDialog({ summary }: { summary: GoalSummary | undefined }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const rf = useRF();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Older servers don't send introSeen: never show rather than nag.
    if (summary && summary.introSeen === false && !summary.goal) setVisible(true);
  }, [summary]);

  function dismiss(then?: () => void) {
    setVisible(false);
    queryClient.setQueryData(["goal"], (prev: object | undefined) => (prev ? { ...prev, introSeen: true } : prev));
    apiPost("/api/goals/intro").catch(() => {});
    then?.();
  }

  const points = [
    "Tally projects where your net worth lands from how fast it grew over the last 3 months.",
    "It tells you whether you're on track, and if not, how much more a month closes the gap.",
    "When you're behind, it points to the spending categories with the most room.",
  ];

  return (
    <TallyDialog
      visible={visible}
      onClose={() => dismiss()}
      tone="brand"
      icon={<Target size={20} color={colors.brand} strokeWidth={2} />}
      title="New: year-end goals"
      subtitle="Pick a net worth to reach by Dec 31."
      actions={[
        // Stacked: the likely choice on top, the dismissive one last (iOS
        // convention, and how the app's other dialogs order theirs).
        { label: "Set a goal", variant: "primary", onPress: () => dismiss(() => router.push("/goals" as Href)) },
        { label: "Not now", variant: "secondary", onPress: () => dismiss() },
      ]}
    >
      <View className="gap-2">
        {points.map((line) => (
          <View key={line} className="flex-row gap-2">
            <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>•</Text>
            <Text className="font-ui text-text flex-1" style={{ fontSize: rf(14), lineHeight: rf(20) }}>{line}</Text>
          </View>
        ))}
      </View>
    </TallyDialog>
  );
}
