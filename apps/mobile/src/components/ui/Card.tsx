import { View, type ViewProps } from "react-native";

// MOBILE_DESIGN.md §3.4 -- soft shadow card, no visible border, 18px radius.
// Shadow values match the mockup's card treatment exactly.
export function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={`bg-surface rounded-card ${className ?? ""}`}
      style={[
        {
          shadowColor: "#1A1917",
          shadowOpacity: 0.07,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
      {...props}
    />
  );
}
