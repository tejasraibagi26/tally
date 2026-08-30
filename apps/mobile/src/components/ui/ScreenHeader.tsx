import { Platform, Pressable, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRF } from "@/theme/responsiveFont";
import { useThemeColors } from "@/theme/useThemeColors";

// These screens (fire, subscriptions, investments, settings) are pushed via
// the native Stack (see _layout.tsx) with a real, always-fixed native
// header -- never part of the ScrollView, so the back control can't drift
// out of alignment on scroll the way a hand-rolled absolutely-positioned
// chevron once did here. iOS's header is transparent (floats over
// ScreenGlow, reserves no layout space, tight to the status bar exactly
// like the tab screens' own top-left title); Android's is a normal opaque
// toolbar instead, since react-native-screens' native-stack doesn't support
// a real transparent floating header there (tested on-device --
// headerTransparent: true still renders a solid bar), and an opaque native
// toolbar is the native Android pattern for a pushed screen anyway. Both
// platforms get NativeBackButton as an explicit headerLeft: native-stack
// renders no back arrow at all once headerTitle is empty (tested,
// regardless of transparency) -- but only Android actually uses it (see
// _layout.tsx); iOS keeps its own default control (e.g. iOS 26's glass
// pill) since a custom headerLeft there would replace it.
export function useScreenContentTop(extra = 12): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "android") return extra; // opaque toolbar already reserves its own space
  return insets.top + 44 + extra; // transparent header reserves nothing -- clear it manually
}

// Android's headerLeft override (see _layout.tsx) -- same circular
// bg-surface-2 treatment as the rest of the app's icon buttons.
export function NativeBackButton() {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 rounded-full items-center justify-center bg-surface-2 ml-3">
      <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
}

// Left clearance so a title row doesn't render underneath a back control --
// only needed on iOS, where the transparent header floats directly over
// this content; Android's back button lives inside its own separate opaque
// toolbar space, never overlapping the screen's own content at all. An
// approximation (iOS 26's glass pill isn't a fixed width) rather than a
// pixel-exact match, the same way any native app leaves breathing room next
// to a system back button instead of hugging it exactly.
const IOS_BACK_CONTROL_CLEARANCE = Platform.OS === "ios" ? 52 : 0;

// Standalone title, for a non-scrolling state (loading/empty) rendered
// directly inside the screen's padded outer View rather than a ScrollView.
export function ScreenHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between px-5 pb-4" style={{ paddingLeft: IOS_BACK_CONTROL_CLEARANCE || undefined }}>
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
// standalone px-5.
export function ScreenTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between pb-1" style={{ paddingLeft: Math.max(0, IOS_BACK_CONTROL_CLEARANCE - 20) }}>
      <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(22) }}>
        {title}
      </Text>
      {action}
    </View>
  );
}
