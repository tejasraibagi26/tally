import { View, Text, Pressable } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wallet, TrendingUp, LineChart, Settings, LogOut, ChevronRight } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline } from "@/theme/colors";

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
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between py-4 active:opacity-70">
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="font-ui-medium text-[15px]" style={{ color: destructive ? colors.negative : colors.text }}>
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
  const { logout, user } = useAuth();
  const soft = { borderTopWidth: 1, borderTopColor: hairline(colors) };

  function go(href: Href) {
    router.back();
    router.push(href);
  }

  return (
    // The sheet itself is a fixed 46% of screen height (_layout.tsx's
    // sheetAllowedDetents), not sized to this content -- without flex-1 here,
    // this View is only as tall as its own rows, and the native sheet's own
    // (light, even in dark mode) background shows through as a bar below it.
    <View className="flex-1 bg-canvas px-5" style={{ paddingTop: 22, paddingBottom: insets.bottom + 16 }}>
      <View className="items-center mb-3">
        <Text className="font-ui-semibold text-[16px] text-text">More</Text>
      </View>
      {user && <Text className="font-ui text-[13px] text-text-2 mb-1 px-1">{user.email}</Text>}

      <View>
        <Row icon={<LineChart size={20} color={colors["text-2"]} strokeWidth={1.75} />} label="Investments" onPress={() => go("/investments")} colors={colors} />
        <View style={soft}>
          <Row icon={<TrendingUp size={20} color={colors["text-2"]} strokeWidth={1.75} />} label="FIRE calculator" onPress={() => go("/fire")} colors={colors} />
        </View>
        <View style={soft}>
          <Row icon={<Wallet size={20} color={colors["text-2"]} strokeWidth={1.75} />} label="Subscriptions" onPress={() => go("/subscriptions")} colors={colors} />
        </View>
        <View style={soft}>
          <Row icon={<Settings size={20} color={colors["text-2"]} strokeWidth={1.75} />} label="Settings" onPress={() => go("/settings")} colors={colors} />
        </View>
        <View style={soft}>
          <Row icon={<LogOut size={20} color={colors.negative} strokeWidth={1.75} />} label="Log out" destructive onPress={() => logout()} colors={colors} />
        </View>
      </View>
    </View>
  );
}
