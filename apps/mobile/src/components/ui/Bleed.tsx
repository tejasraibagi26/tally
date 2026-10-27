import type { ReactNode } from "react";
import { View } from "react-native";
import { useUiLook } from "@/lib/UiLookContext";

/**
 * Tally Pop runs charts edge to edge of their card: this cancels the
 * container's side padding (`inset`, its px value) in Pop and does nothing
 * in the classic look. Charts here size themselves from onLayout, so they
 * simply measure wider.
 */
export function Bleed({ inset = 20, children }: { inset?: number; children: ReactNode }) {
  const { pop } = useUiLook();
  return <View style={pop ? { marginHorizontal: -inset } : null}>{children}</View>;
}
