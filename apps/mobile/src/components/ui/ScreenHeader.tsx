import { Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";

// These screens (fire, subscriptions, investments, settings) are pushed via
// the native Stack (see _layout.tsx) with a real, always-fixed native
// header -- title included, left-aligned next to the back control -- never
// part of the ScrollView, so the back control can't drift out of alignment
// on scroll the way a hand-rolled absolutely-positioned chevron once did
// here. iOS's header is transparent (floats over ScreenGlow, reserves no
// layout space, tight to the status bar exactly like the tab screens' own
// top-left title); Android's is a normal opaque toolbar instead, since
// react-native-screens' native-stack doesn't support a real transparent
// floating header there (tested on-device -- headerTransparent: true still
// renders a solid bar), and an opaque native toolbar is the native Android
// pattern for a pushed screen anyway.
export function useScreenContentTop(extra = 12): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "android") return extra; // opaque toolbar already reserves its own space
  return insets.top + 44 + extra; // transparent header reserves nothing -- clear it manually
}

// Android's headerLeft override (see _layout.tsx) -- native-stack renders no
// back arrow at all once headerTitle is empty (tested); same circular
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
