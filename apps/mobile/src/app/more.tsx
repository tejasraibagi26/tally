import { View, Text, Pressable } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Repeat, TrendingUp, Flame, Settings, LogOut, ChevronRight } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import { APP_VERSION, BUILD_SHA } from "@/lib/version";

function Row({
  icon,
  label,
  onPress,
  destructive,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const rf = useRF();
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between px-4 py-3.5 active:opacity-70">
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="font-ui-medium" style={{ color: destructive ? colors.negative : colors.text, fontSize: rf(15) }}>
          {label}
        </Text>
      </View>
      {!destructive && <ChevronRight size={16} color={colors["text-3"]} />}
    </Pressable>
  );
}

// This screen is presented as a content-sized bottom sheet (see _layout.tsx's
// sheetAllowedDetents: "fitToContents") -- rows navigate by closing the sheet
// first, then pushing the destination, so e.g. Investments opens as a plain
// push from (tabs) instead of nesting inside this sheet's own presentation
// context (which would otherwise carry its rounded-sheet chrome along too).
export default function MoreScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const rf = useRF();
  const soft = { borderTopWidth: 1, borderTopColor: hairline(colors) };
  const caption = { fontSize: rf(11), letterSpacing: 0.66, textTransform: "uppercase" as const };

  function go(href: Href) {
    router.back();
    router.push(href);
  }

  return (
    // The sheet itself is a fixed 60% of screen height (_layout.tsx's
    // sheetAllowedDetents), not sized to this content -- without flex-1 here,
    // this View is only as tall as its own rows, and the native sheet's own
    // (light, even in dark mode) background shows through as a bar below it.
    <View className="flex-1 bg-surface px-5" style={{ paddingTop: 22, paddingBottom: insets.bottom + 16 }}>
      <View className="items-center mb-3">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>More</Text>
      </View>
      {/* Same order, names and icons as web's side nav (Your money → What
          you have → Plan ahead), collapsed into one card because mobile has
          no Rules or Credit cards screens yet -- five headings over single
          rows read as empty. Split along web's groups once those exist.
          Account actions get their own card, like web's footer. */}
      <View className="gap-2">
        <Text className="font-ui-medium text-text-3 px-1" style={caption}>Your money</Text>
        <View className="rounded-card bg-surface-2 border border-border overflow-hidden">
          <Row icon={<Repeat size={19} color={colors["text-2"]} strokeWidth={1.75} />} label="Subscriptions" onPress={() => go("/subscriptions")} colors={colors} />
          <View style={soft}>
            <Row icon={<TrendingUp size={19} color={colors["text-2"]} strokeWidth={1.75} />} label="Investments" onPress={() => go("/investments")} colors={colors} />
          </View>
          <View style={soft}>
            <Row icon={<Flame size={19} color={colors["text-2"]} strokeWidth={1.75} />} label="Early retirement" onPress={() => go("/fire")} colors={colors} />
          </View>
        </View>
      </View>

      <View className="gap-2 mt-5">
        <Text className="font-ui-medium text-text-3 px-1" style={caption}>Account</Text>
        <View className="rounded-card bg-surface-2 border border-border overflow-hidden">
          <Row icon={<Settings size={19} color={colors["text-2"]} strokeWidth={1.75} />} label="Settings" onPress={() => go("/settings")} colors={colors} />
          <View style={soft}>
            <Row icon={<LogOut size={19} color={colors.negative} strokeWidth={1.75} />} label="Sign out" destructive onPress={() => logout()} colors={colors} />
          </View>
        </View>
      </View>

      {/* The only way into the changelog -- tapping the build line. Kept as
          quiet as before; the trailing "Changelog" is the only hint. */}
      <View className="items-center mt-4">
        <Pressable onPress={() => go("/changelog")} hitSlop={12} accessibilityRole="link" accessibilityLabel={`Version ${APP_VERSION}, open changelog`}>
          <Text
            className="text-text-3"
            style={{ fontFamily: "JetBrainsMono", letterSpacing: 0.2, fontSize: rf(10.5) }}
          >
            Build v{APP_VERSION} · {BUILD_SHA} · Changelog
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
