import { Image, Text, View } from "react-native";
import { isDarkBrandColor, type CardNetwork } from "@tally/core/cardView";
import { useThemeColors } from "@/theme/useThemeColors";

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** Simple network marks drawn with Views and text -- no images or network fetch. */
function NetworkMark({ network, light, scale }: { network: CardNetwork; light: boolean; scale: number }) {
  if (network === "mastercard") {
    const d = 9 * scale;
    return (
      <View style={{ width: d * 1.65, height: d }} accessibilityLabel="Mastercard">
        <View style={{ position: "absolute", left: 0, width: d, height: d, borderRadius: d / 2, backgroundColor: "#EB001B" }} />
        <View style={{ position: "absolute", left: d * 0.65, width: d, height: d, borderRadius: d / 2, backgroundColor: "#F79E1B", opacity: 0.9 }} />
      </View>
    );
  }
  if (network === "amex") {
    return (
      <View style={{ backgroundColor: "#2E77BC", borderRadius: 1.5 * scale, paddingHorizontal: 2 * scale, paddingVertical: 1 * scale }} accessibilityLabel="American Express">
        <Text style={{ color: "#FFFFFF", fontSize: 5.5 * scale, fontWeight: "800", letterSpacing: 0.2 }}>AMEX</Text>
      </View>
    );
  }
  return (
    <Text style={{ color: light ? "#1A1F71" : "#FFFFFF", fontSize: 8 * scale, fontWeight: "900", fontStyle: "italic", letterSpacing: 0.3 }} accessibilityLabel="Visa">
      VISA
    </Text>
  );
}

/**
 * A card-shaped tile in the bank's brand color with its logo (on white, so
 * dark logos stay visible) and the network mark -- web's CardTile. Every
 * part falls back: no logo shows the bank's initials, no color a neutral
 * tile, an unknown network no mark.
 */
export function CardTile({
  bankName,
  color,
  logo,
  network,
  size = "sm",
  mask,
}: {
  bankName: string;
  color: string | null;
  logo: string | null;
  network: CardNetwork | null;
  size?: "sm" | "lg";
  mask?: string | null;
}) {
  const colors = useThemeColors();
  const dark = isDarkBrandColor(color);
  const s = size === "lg" ? 2 : 1;
  const w = 44 * s;
  const h = 30 * s;
  const badge = 12 * s;
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 6 * s,
        overflow: "hidden",
        backgroundColor: color ?? colors["surface-2"],
        borderWidth: color && dark ? 0 : 1,
        borderColor: colors.border,
      }}
      accessibilityRole="image"
      accessibilityLabel={`${bankName}${network ? ` ${network}` : ""} card`}
    >
      <View
        style={{
          position: "absolute",
          left: 4 * s,
          top: 4 * s,
          minWidth: badge,
          height: badge,
          borderRadius: 3 * s,
          paddingHorizontal: logo ? 0 : 2 * s,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: logo ? "#FFFFFF" : color ? (dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)") : colors.sunken,
        }}
      >
        {logo ? (
          <Image source={{ uri: logo }} style={{ width: badge, height: badge }} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: 6.5 * s, fontWeight: "700", color: color && dark ? "#FFFFFF" : colors["text-2"] }}>{initials(bankName)}</Text>
        )}
      </View>
      {size === "lg" && mask && (
        // Top-right, across from the logo, so it never meets the network mark at the bottom.
        <Text style={{ position: "absolute", right: 8, top: 7, fontFamily: "JetBrainsMono", fontSize: 10, color: dark ? "rgba(255,255,255,0.85)" : colors["text-2"] }}>••{mask}</Text>
      )}
      {network && (
        <View style={{ position: "absolute", right: 4 * s, bottom: 3 * s }}>
          <NetworkMark network={network} light={!dark} scale={s} />
        </View>
      )}
    </View>
  );
}
