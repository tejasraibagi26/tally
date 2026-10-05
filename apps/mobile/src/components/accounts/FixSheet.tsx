import { View, Text } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import type { Institution } from "@/lib/queries/accounts";
import type { ConnectionAction, ConnectionState } from "@/lib/connectionState";
import { StateButton, toneColor, toneSubtle } from "@/components/accounts/InstitutionCard";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Every connection that needs a tap, with its own action, opened from the
 * attention strip. Tapping an action closes the sheet first: Plaid Link
 * presents its own native modal, which can't stack on top of this one.
 */
export function FixSheet({
  visible,
  onClose,
  items,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  items: { institution: Institution; state: ConnectionState }[];
  onAction: (institution: Institution, action: ConnectionAction) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="70%">
      <View className="px-5 pt-1 pb-3">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }}>
          {items.length} bank{items.length === 1 ? " needs" : "s need"} you
        </Text>
      </View>
      {items.map(({ institution, state }, i) => {
        const name = institution.institutionName ?? "Unknown";
        return (
          <View key={institution.id} className="flex-row items-center gap-3 px-5 py-3.5" style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
            <View className="w-8 h-8 rounded-[10px] items-center justify-center" style={{ backgroundColor: toneSubtle(colors, state.tone) }}>
              <Text className="font-ui-semibold" style={{ color: toneColor(colors, state.tone), fontSize: rf(13) }}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }} numberOfLines={1}>{name}</Text>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }} numberOfLines={1}>{state.notice?.title ?? state.statusLine}</Text>
            </View>
            {state.action && (
              <StateButton
                action={state.action}
                tone={state.tone}
                pending={state.actionPending}
                onPress={() => {
                  onClose();
                  onAction(institution, state.action!);
                }}
              />
            )}
          </View>
        );
      })}
    </Sheet>
  );
}
