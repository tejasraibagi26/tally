import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";

// Matches the tab screens' own top-left title treatment (Overview, Budgets,
// etc.) instead of the native nav header -- these screens are pushed, not
// tabs, so they still need an explicit way back; the native header's
// centered title + "Back" label is replaced with a chevron beside a
// left-aligned title, consistent with the rest of the app's headers.
// `action` renders a small control at the header's right end (e.g. FIRE's
// "Save" button, which used to be a full-width pill at the bottom of the
// screen -- moved here to stop eating a large chunk of vertical space).
export function ScreenHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center justify-between px-5 pb-4">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text className="font-ui-semibold text-[22px] text-text" style={{ letterSpacing: -0.3 }}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}
