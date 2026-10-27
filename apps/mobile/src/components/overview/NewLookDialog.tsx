import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { TallyDialog } from "@/components/ui/TallyDialog";
import { apiPost } from "@/lib/api";
import { useUiLook } from "@/lib/UiLookContext";
import type { AccountProfile } from "@/lib/queries/account";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Mobile's one-time announcement of Tally Pop becoming the default look
 * (web's NewLookModal): once per account (POST /api/announcements/seen
 * "new-look"), and only when the account hasn't chosen classic -- read from
 * the account itself, not the cached look, so a classic opt-out on a fresh
 * install never sees it. "Use the classic look" is Settings' "New look"
 * switch turned off. The cache isn't updated on dismiss, so the goals intro
 * waits for the next visit rather than popping up right after.
 */
export function NewLookDialog({ profile }: { profile: AccountProfile | undefined }) {
  const { setPop } = useUiLook();
  const colors = useThemeColors();
  const rf = useRF();
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Older servers don't send the list: never show rather than nag.
    if (done || !profile?.seenAnnouncements) return;
    if (!profile.seenAnnouncements.includes("new-look") && profile.uiLook !== "classic") setVisible(true);
  }, [profile, done]);

  function dismiss(classic = false) {
    setVisible(false);
    setDone(true);
    apiPost("/api/announcements/seen", { key: "new-look" }).catch(() => {});
    if (classic) setPop(false);
  }

  const points = [
    "Brighter colors, bolder type, and charts that run edge to edge.",
    "Your recap emails and the web app match it too.",
    "Prefer the old one? Turn off New look in Settings any time.",
  ];

  return (
    <TallyDialog
      visible={visible}
      onClose={() => dismiss()}
      tone="brand"
      icon={<Sparkles size={20} color={colors.brand} strokeWidth={2} />}
      title="Tally has a new look"
      subtitle="Same numbers, more fun to check."
      actions={[
        // Stacked: the likely choice on top, the opt-out last.
        { label: "Looks good", variant: "primary", onPress: () => dismiss() },
        { label: "Use the classic look", variant: "secondary", onPress: () => dismiss(true) },
      ]}
    >
      <View className="gap-2">
        {points.map((line) => (
          <View key={line} className="flex-row gap-2">
            <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>•</Text>
            <Text className="font-ui text-text flex-1" style={{ fontSize: rf(14), lineHeight: rf(20) }}>{line}</Text>
          </View>
        ))}
      </View>
    </TallyDialog>
  );
}
