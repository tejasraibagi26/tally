import { Platform, Pressable, Text, View } from "react-native";
import { useRouter, type NativeStackHeaderProps } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// These screens (fire, subscriptions, investments, settings, …) are pushed
// via the native Stack (see _layout.tsx) with an always-fixed header --
// never part of the ScrollView, so the back control can't drift on scroll
// the way a hand-rolled absolutely-positioned chevron once did here. The
// header is transparent on both platforms and reserves no layout space, so
// content needs this top padding to clear it:
// - iOS: the native transparent header (44pt + status bar).
// - Android: TransparentHeader below (56dp + status bar). The native
//   Android toolbar can't be made transparent reliably -- an earlier
//   on-device test rendered a solid bar -- so Android draws its own.
const ANDROID_HEADER_HEIGHT = 56;

export function useScreenContentTop(extra = 12): number {
  const insets = useSafeAreaInsets();
  return insets.top + (Platform.OS === "android" ? ANDROID_HEADER_HEIGHT : 44) + extra;
}

// Android's pushed-screen header (the `header` option in _layout.tsx's
// pushedScreenOptions, with headerTransparent so it floats): a plain view
// with no background -- back arrow, title, and the screen's headerRight
// (Investments' Sync, FIRE's Save) -- so the page and its ScreenGlow show
// straight through to the top of the screen, like iOS's transparent header.
export function TransparentHeader({ options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const rf = useRF();
  const title = typeof options.headerTitle === "string" ? options.headerTitle : (options.title ?? "");
  return (
    <View
      className="flex-row items-center"
      style={{ paddingTop: insets.top, height: insets.top + ANDROID_HEADER_HEIGHT, paddingLeft: back ? 4 : 20, paddingRight: 12 }}
    >
      {back && <NativeBackButton />}
      <Text className="font-ui-semibold text-text flex-1" style={{ fontSize: rf(20), marginLeft: back ? 6 : 0 }} numberOfLines={1}>
        {title}
      </Text>
      {options.headerRight?.({ tintColor: colors.brand, canGoBack: back != null })}
    </View>
  );
}

// The back control in TransparentHeader (Android). A bare chevron, no
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
