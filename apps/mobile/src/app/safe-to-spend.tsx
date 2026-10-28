import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Card } from "@/components/ui/Card";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { useSafeToSpendSettings, useSaveSafeToSpendSettings } from "@/lib/queries/safeToSpend";
import { NextPaychequeCard } from "@/components/settings/NextPaychequeCard";
import { DayOfMonthPicker } from "@/components/ui/DayOfMonthPicker";

// Native port of web's Settings → Safe to spend (components/settings/
// SafeToSpendSettings.tsx) plus the "Next paycheque" line from Income:
// same API, same wording. Tally Pop only, like the Overview card. The
// "Next paycheque" card is shared with the Income screen.

function AmountInput({ value, onChange, onSave, label }: { value: string; onChange: (v: string) => void; onSave: () => void; label: string }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-center h-11 rounded-control bg-surface-2 px-3" style={{ borderWidth: 1, borderColor: colors["border-strong"] }}>
      <Text className="font-ui text-text-3" style={{ fontSize: rf(15) }}>$</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^\d.]/g, ""))}
        onBlur={onSave}
        onSubmitEditing={onSave}
        keyboardType="decimal-pad"
        returnKeyType="done"
        accessibilityLabel={label}
        className="font-ui text-text text-right"
        style={{ fontSize: rf(15), minWidth: 64, paddingLeft: 4, fontVariant: ["tabular-nums"] }}
      />
    </View>
  );
}

function DueDayRow({ card, isLast }: { card: { id: string; label: string; dueDay: number | null }; isLast: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const save = useSaveSafeToSpendSettings();
  const [value, setValue] = useState(card.dueDay);
  const [failed, setFailed] = useState(false);

  async function pick(next: number | null) {
    const prev = value;
    setValue(next);
    setFailed(false);
    try {
      await save.mutateAsync({ dueDays: { [card.id]: next } });
    } catch {
      setValue(prev);
      setFailed(true);
    }
  }

  return (
    <View className="py-4 gap-2" style={!isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>{card.label} payment due</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>The day of the month it&apos;s due. Your bank doesn&apos;t report it, so until you set it, safe to spend assumes it&apos;s due before payday.</Text>
        </View>
        <DayOfMonthPicker value={value} onChange={pick} disabled={save.isPending} label={`${card.label} payment due day`} />
      </View>
      {failed && <Text className="font-ui self-end text-negative" style={{ fontSize: rf(12) }}>Couldn&apos;t save. Try again.</Text>}
    </View>
  );
}

export default function SafeToSpendScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const settings = useSafeToSpendSettings();
  const save = useSaveSafeToSpendSettings();

  const [cushion, setCushion] = useState("");
  const [cushionMsg, setCushionMsg] = useState<string | null>(null);
  useEffect(() => {
    if (settings.data) setCushion(String(settings.data.cushion / 100));
  }, [settings.data?.cushion]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCushion() {
    const cents = Math.round(Number(cushion || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0 || cents > 10_000_000) {
      setCushionMsg("Enter an amount from $0 to $100,000.");
      return;
    }
    if (cents === settings.data?.cushion) return;
    try {
      await save.mutateAsync({ cushion: cents });
      setCushionMsg("Saved");
    } catch {
      setCushionMsg("Couldn't save. Try again.");
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-canvas" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
        <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(13.5) }}>
          Which accounts count as spending money, and how much to always keep back.
        </Text>

        <NextPaychequeCard />

        {settings.isLoading || !settings.data ? (
          <ActivityIndicator className="mt-4" />
        ) : (
          <>
            <Card className="px-5">
              {settings.data.accounts.map((a) => (
                <View key={a.id} className="flex-row items-center gap-3 py-4" style={{ borderBottomWidth: 1, borderBottomColor: hairline(colors) }}>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>{a.label}</Text>
                    <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>{a.kind}</Text>
                  </View>
                  <Switch
                    style={{ alignSelf: "center" }}
                    accessibilityLabel={`Count ${a.label} as spending money`}
                    value={a.counts}
                    onValueChange={(counts) => save.mutate({ accounts: { [a.id]: counts } })}
                    trackColor={{ false: colors["border-strong"], true: colors.brand }}
                    ios_backgroundColor={colors["border-strong"]}
                  />
                </View>
              ))}
              <View className="py-4 gap-2" style={settings.data.cards.length > 0 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}>
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>Cushion</Text>
                    <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>Safe to spend never dips into this.</Text>
                  </View>
                  <AmountInput value={cushion} onChange={(v) => { setCushion(v); setCushionMsg(null); }} onSave={saveCushion} label="Cushion in dollars" />
                </View>
                {cushionMsg && <Text className={`font-ui self-end ${cushionMsg === "Saved" ? "text-text-3" : "text-negative"}`} style={{ fontSize: rf(12) }}>{cushionMsg}</Text>}
              </View>
              {settings.data.cards.map((c, i, arr) => (
                <DueDayRow key={c.id} card={c} isLast={i === arr.length - 1} />
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
