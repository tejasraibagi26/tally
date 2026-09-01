import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock as LockIcon } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { ScreenGlow } from "@/components/ui/ScreenGlow";

// Rendered in place of (tabs) whenever AuthContext.isLocked is true (see
// _layout.tsx's Stack.Protected guard) -- not a modal overlaid on top of the
// real screens, so financial data is never actually mounted underneath it.
// Prompts immediately on mount; the button below is the retry path for a
// dismissed/failed system prompt, not the primary flow.
export default function LockScreen() {
  const { unlock, logout } = useAuth();
  const colors = useThemeColors();
  const rf = useRF();
  const insets = useSafeAreaInsets();
  const [attempting, setAttempting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function attempt() {
    setAttempting(true);
    setFailed(false);
    const ok = await unlock();
    setAttempting(false);
    if (!ok) setFailed(true);
  }

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-canvas items-center justify-center" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScreenGlow />
      <View className="items-center gap-4 px-8">
        <View className="w-16 h-16 rounded-full items-center justify-center bg-brand-subtle">
          <LockIcon size={28} color={colors.brand} strokeWidth={1.75} />
        </View>
        <Text className="font-display text-text text-center" style={{ fontSize: rf(24) }}>
          Tally is locked
        </Text>
        {failed && (
          <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(14) }}>
            Couldn&apos;t verify it&apos;s you — try again.
          </Text>
        )}
        <Pressable onPress={attempt} disabled={attempting} className="rounded-full bg-brand px-6 py-3 mt-2 disabled:opacity-50">
          <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>
            {attempting ? "Checking…" : "Unlock"}
          </Text>
        </Pressable>
        <Pressable onPress={logout} hitSlop={8} className="mt-2">
          <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>
            Log out instead
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
