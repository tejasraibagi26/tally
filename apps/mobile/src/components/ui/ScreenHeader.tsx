import { Pressable, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRF } from "@/theme/responsiveFont";
import { useThemeColors } from "@/theme/useThemeColors";

// These screens (fire, subscriptions, investments, settings) are pushed via
// the native Stack with headerShown: true + headerTransparent: true + an
// empty headerTitle (see _layout.tsx) -- the header reserves no layout
// space of its own, so the screen's own content starts right under the
// status bar exactly like the tab screens' top-left title (Overview,
// Budgets, etc.) does, instead of leaving a dead gap for a reserved native
// bar. The back control is a real, always-fixed native header element (not
// part of the ScrollView, so it can never drift out of alignment on scroll
// the way a hand-rolled absolutely-positioned chevron once did here) -- on
// iOS that's the platform's own default (e.g. iOS 26's glass pill); on
// Android, native-stack renders no back arrow at all when the header is
// both transparent and title-less (tested on-device), so _layout.tsx
// supplies NativeBackButton as an explicit headerLeft there instead.
export function useScreenContentTop(extra = 12): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

// Android's headerLeft override (see _layout.tsx) -- same circular
// bg-surface-2 treatment as the rest of the app's icon buttons, since
// there's no native back arrow to fall back on once the header goes
// transparent + title-less on this platform.
export function NativeBackButton() {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 rounded-full items-center justify-center bg-surface-2 ml-3">
      <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
}

// Left clearance so a title row doesn't render underneath whatever back
// control the native header puts in its top-left corner -- an approximation
// (real native back controls vary by platform/OS version, e.g. iOS 26's
// glass pill isn't the same width as Android's plain chevron) rather than a
// pixel-exact match, the same way any native app leaves breathing room next
// to a system back button instead of hugging it exactly.
const BACK_CONTROL_CLEARANCE = 52;

// Standalone title, for a non-scrolling state (loading/empty) rendered
// directly inside the screen's padded outer View rather than a ScrollView.
export function ScreenHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between pr-5 pb-4" style={{ paddingLeft: BACK_CONTROL_CLEARANCE }}>
      <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(22) }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

// Same title treatment, for use as the first child inside a ScrollView
// whose contentContainerStyle already supplies paddingHorizontal for every
// row -- paddingLeft here is in addition to that, unlike ScreenHeader's
// standalone pr-5.
export function ScreenTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between pb-1" style={{ paddingLeft: BACK_CONTROL_CLEARANCE - 20 }}>
      <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(22) }}>
        {title}
      </Text>
      {action}
    </View>
  );
}
