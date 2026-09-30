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
// back arrow at all once headerTitle is empty (tested). A bare chevron, no
// circular background (it read as a heavy extra element next to the title);
// the 32px tile stays as its touch target. android_ripple is disabled for
// the same reason as (tabs)/_layout.tsx's NoRippleTabButton (the default
// ripple draws a rectangular highlight), so a pressed-state dim stands in
// for it.
export function NativeBackButton() {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      android_ripple={null}
      className="w-8 h-8 items-center justify-center ml-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
}
