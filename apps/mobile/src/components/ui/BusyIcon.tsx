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
