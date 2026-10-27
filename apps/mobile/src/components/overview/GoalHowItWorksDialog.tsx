import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Info } from "lucide-react-native";
import { GOAL_HOW_IT_WORKS } from "@tally/core/goalMath";
import { TallyDialog } from "@/components/ui/TallyDialog";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * "How it works" on the Goals screen (web's GoalHowItWorks): the explainer
 * behind the projection, opened on demand -- the one-time announcement is
 * GoalIntroDialog. Scrolls on a small phone rather than pushing the button
 * off screen.
 */
export function GoalHowItWorksDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const { height } = useWindowDimensions();
  return (
    <TallyDialog
      visible={visible}
      onClose={onClose}
      tone="brand"
      icon={<Info size={20} color={colors.brand} strokeWidth={2} />}
      title="How year-end goals work"
      subtitle="What Tally measures, and how it decides if you're on track."
      actions={[{ label: "Got it", variant: "primary", onPress: onClose }]}
    >
      <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {GOAL_HOW_IT_WORKS.map((step, i) => (
            <View key={step.title} className="flex-row gap-3">
              <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors["brand-subtle"] }}>
                <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: colors.brand }}>{i + 1}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }}>{step.title}</Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </TallyDialog>
  );
}
