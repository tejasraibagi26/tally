import { useColorScheme } from "nativewind";
import { View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useThemeColors } from "@/theme/useThemeColors";

// A single static radial highlight centered at the top of a tab screen --
// no wash layer, no sweep animation. Sits behind the header/hero content,
// not inside the ScrollView, so it stays fixed at the top instead of
// scrolling away.
export function ScreenGlow({ height = 380 }: { height?: number }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const orbAlpha = colorScheme === "dark" ? 0.09 : 0.05;
  const orbSize = 560;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: -orbSize * 0.5, left: (width - orbSize) / 2, width: orbSize, height: orbSize }}>
        <Svg width={orbSize} height={orbSize}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={orbAlpha} />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={orbSize} height={orbSize} fill="url(#glow)" />
        </Svg>
      </View>
    </View>
  );
}
