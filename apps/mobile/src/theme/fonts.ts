import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";

// Bundled as real font assets (not a CSS @import) -- MOBILE_DESIGN.md §3.3.
// Referenced from tailwind.config.js's fontFamily as "Inter", "InstrumentSerif",
// "JetBrainsMono" -- the keys here must match those names exactly.
export const fontsToLoad = {
  Inter: Inter_400Regular,
  Inter_Medium: Inter_500Medium,
  Inter_SemiBold: Inter_600SemiBold,
  InstrumentSerif: InstrumentSerif_400Regular,
  JetBrainsMono: JetBrainsMono_400Regular,
  JetBrainsMono_Medium: JetBrainsMono_500Medium,
  // Tally Pop (theme/pop.ts POP_FONTS): swapped in behind font-ui /
  // font-display through CSS variables, so both looks are always loaded.
  Figtree: Figtree_400Regular,
  Figtree_SemiBold: Figtree_600SemiBold,
  Figtree_Bold: Figtree_700Bold,
  BricolageGrotesque_ExtraBold: BricolageGrotesque_800ExtraBold,
};
