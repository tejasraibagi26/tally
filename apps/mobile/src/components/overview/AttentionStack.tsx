import { View } from "react-native";
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
    <View className="gap-3">
      <NeedsYouCard items={items} />
      <ReviewCard count={unreviewed} />
    </View>
  );
}
