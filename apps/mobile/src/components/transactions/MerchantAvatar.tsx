import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useRF } from "@/theme/responsiveFont";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * A merchant's logo (Plaid's, resolved server-side by the web app's
 * lib/merchantLogos.ts) in the rounded tile rows already use, falling back
 * to the name's first letter when there's no logo or it fails to load. A
 * logo always sits on white, in both themes: many are dark marks on a
 * transparent background (Uber's black wordmark) and vanish on the dark tile.
 * React Native's own Image caches on both platforms, so no new native
 * module is needed. Transfers and rows you added never get a logo.
 */
export function MerchantAvatar({
  name,
  logoUrl,
  size,
  radius,
  fontSize,
}: {
  name: string;
  logoUrl?: string | null;
  size: number;
  radius: number;
  fontSize: number;
}) {
  const rf = useRF();
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const showLogo = !!logoUrl && !failed;
  return (
    <View
      className="bg-surface-2 items-center justify-center overflow-hidden"
      style={[{ width: size, height: size, borderRadius: radius }, showLogo && { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border }]}
    >
      {showLogo ? (
        <Image source={{ uri: logoUrl! }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(fontSize) }}>{name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}
