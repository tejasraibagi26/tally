import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import type { Institution } from "@/lib/queries/accounts";
import { NeedsYouCard, useNeedsYouItems } from "@/components/overview/NeedsYouCard";
import { ReviewCard } from "@/components/overview/ReviewCard";

/**
 * Everything that wants a tap, grouped so the two cards sit close together
 * and the whole block takes no space when there's nothing to say.
 */
export function AttentionStack({ institutions, unreviewed }: { institutions: Institution[]; unreviewed: number }) {
  const items = useNeedsYouItems(institutions);
  if (items.length === 0 && unreviewed <= 0) return null;
  return (
    // Fades in and out over 200ms instead of popping; Reanimated skips it when the OS reduce-motion setting is on.
    <Animated.View style={{ gap: 12 }} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(200)}>
      <NeedsYouCard items={items} />
      <ReviewCard count={unreviewed} />
    </Animated.View>
  );
}
