import { View, type ViewProps } from "react-native";
import { useColorScheme } from "nativewind";

// MOBILE_DESIGN.md §3.4 -- soft shadow card, no visible border, 18px radius.
// Shadow values match the mockup's card treatment exactly. MOBILE_DESIGN.md
// §3.4 also calls for dark mode to drop/reduce the shadow (same rule as
// web's DESIGN.md §6) since a light-on-dark shadow reads as a visible halo
// rather than depth.
export function Card({ className, style, ...props }: ViewProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  return (
    <View
      className={`bg-surface rounded-card ${className ?? ""}`}
      style={[
        {
          shadowColor: "#000000",
          shadowOpacity: dark ? 0 : 0.07,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
          elevation: dark ? 0 : 2,
        },
        style,
      ]}
      {...props}
    />
  );
}
