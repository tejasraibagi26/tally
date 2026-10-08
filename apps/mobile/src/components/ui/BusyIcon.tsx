import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

/**
 * A fixed-size icon slot that swaps its icon for a spinner while busy, so a
 * pill or row is exactly the same size idle and busy. ActivityIndicator's
 * "small" is 20pt on iOS, larger than the icons beside our labels, so it's
 * scaled down to fit the slot.
 */
export function BusyIcon({ busy, color, size = 16, children }: { busy: boolean; color: string; size?: number; children: ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {busy ? <ActivityIndicator size="small" color={color} style={{ transform: [{ scale: size / 20 }] }} /> : children}
    </View>
  );
}

/**
 * A label that can show a spinner without the button changing size: equal
 * fixed slots on both sides, the left one becoming the spinner while busy,
 * so the label stays centred and visible in both states (mobile's version
 * of web Button's reserved spinner room).
 */
export function BusyLabel({ busy, color, gap = 6, size = 14, children }: { busy: boolean; color: string; gap?: number; size?: number; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      <BusyIcon busy={busy} color={color} size={size}>
        {null}
      </BusyIcon>
      {children}
      <View style={{ width: size, height: size }} />
    </View>
  );
}
