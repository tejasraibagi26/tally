import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// Matches the tab screens' own top-left title treatment (Overview, Budgets,
// etc.) instead of the native nav header -- these screens are pushed, not
// tabs, so they still need an explicit way back; the native header's
// centered title + "Back" label is replaced with a chevron beside a
// left-aligned title, consistent with the rest of the app's headers.
// `action` renders a small control at the header's right end (e.g. FIRE's
// "Save" button, which used to be a full-width pill at the bottom of the
// screen -- moved here to stop eating a large chunk of vertical space).
//
// For non-scrolling states (loading/empty) this is the whole header. For a
// screen with a ScrollView, use ScreenBackButton (fixed, outside the
// ScrollView) + ScreenTitle (scrolls with the content) instead, so only the
// back chevron stays put -- matching a native large-title nav bar rather
// than a header that scrolls away as one block with the page.
export function ScreenHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between px-5 pb-4">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(22) }}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

// Fixed back chevron -- render as a sibling of the ScrollView (not inside
// it), positioned absolutely so it stays on screen while the ScrollView's
// content, including ScreenTitle, scrolls underneath it. Computes its own
// top inset rather than relying on the parent View's paddingTop: RN's
// position:absolute is relative to the parent's border box, not its padding
// box (unlike CSS on web) -- a `top` here is unaffected by the container's
// paddingTop, so without this it renders flush against the physical screen
// edge, under the status bar/notch.
export function ScreenBackButton() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={{ position: "absolute", top: insets.top + 14, left: 20, zIndex: 10 }}>
      <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
}

// Title + optional action, meant to be the first child inside the
// ScrollView's content -- pairs with ScreenBackButton. `paddingLeft`
// leaves room for the fixed chevron (20 left inset + 24 icon + 12 gap = 56,
// minus the ScrollView's own 20px horizontal padding).
export function ScreenTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between" style={{ paddingLeft: 36 }}>
      <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(22) }}>
        {title}
      </Text>
      {action}
    </View>
  );
}
