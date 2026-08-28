import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";

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
};
