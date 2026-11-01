import type { ReactNode } from "react";
import { View } from "react-native";

/** Pop's card outline (--border-card, theme/pop.ts). */
const POP_CARD_BORDER = 2;

/**
 * Charts run edge to edge of their card: this cancels the container's side
 * padding (`inset`, its px value). Charts here size themselves from onLayout, so they
 * simply measure wider. They stop at the card's ink outline, not on it:
 * cancelling the full padding drew them over the outline.
 */
export function Bleed({ inset = 20, children }: { inset?: number; children: ReactNode }) {
  return <View style={{ marginHorizontal: -(inset - POP_CARD_BORDER) }}>{children}</View>;
}
