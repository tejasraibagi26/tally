import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { CalendarCheck } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { CADENCE_LABEL } from "@tally/core/paycheque";
import { Card } from "@/components/ui/Card";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useSafeToSpend, useSafeToSpendSettings, useSaveSafeToSpendSettings } from "@/lib/queries/safeToSpend";

// Native port of web's Settings → Safe to spend (components/settings/
// SafeToSpendSettings.tsx) plus the "Next paycheque" line from Income:
// same API, same wording. Tally Pop only, like the Overview card.

function payday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function AmountInput({ value, onChange, onSave, label, prefix = "$", placeholder }: { value: string; onChange: (v: string) => void; onSave: () => void; label: string; prefix?: string; placeholder?: string }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-center h-11 rounded-control bg-surface-2 px-3" style={{ borderWidth: 1, borderColor: colors["border-strong"] }}>
      {prefix ? <Text className="font-ui text-text-3" style={{ fontSize: rf(15) }}>{prefix}</Text> : null}
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors["text-3"]}
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
  const [value, setValue] = useState(card.dueDay == null ? "" : card.dueDay === 0 ? "31" : String(card.dueDay));
  const [msg, setMsg] = useState<string | null>(null);

  async function commit() {
    const day = value.trim() === "" ? null : Number(value);
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setMsg("Enter a day from 1 to 31.");
      return;
    }
    // 31 means "the last day", so it lands on Feb 28 and Apr 30 too.
    const stored = day === 31 ? 0 : day;
    if (stored === card.dueDay) return;
    try {
      await save.mutateAsync({ dueDays: { [card.id]: stored } });
      setMsg("Saved");
    } catch {
      setMsg("Couldn't save. Try again.");
    }
  }

  return (
    <View className="py-4 gap-2" style={!isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>{card.label} due day</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>Your bank doesn&apos;t report it, so Tally assumes it&apos;s due before payday.</Text>
        </View>
        <AmountInput prefix="" placeholder="e.g. 22" value={value} onChange={(v) => { setValue(v); setMsg(null); }} onSave={commit} label={`${card.label} payment due day`} />
      </View>
      {msg && <Text className={`font-ui self-end ${msg === "Saved" ? "text-text-3" : "text-negative"}`} style={{ fontSize: rf(12) }}>{msg}</Text>}
    </View>
  );
}

export default function SafeToSpendScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { hidden } = usePrivacy();
  const settings = useSafeToSpendSettings();
  const safe = useSafeToSpend();
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

  const p = safe.data?.paycheque ?? null;

  return (
    <KeyboardAvoidingView className="flex-1 bg-canvas" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
        <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(13.5) }}>
          Which accounts count as spending money, and how much to always keep back.
        </Text>

        <Card className="p-5 flex-row items-start gap-3.5">
          <View className="items-center justify-center rounded-control" style={{ width: 40, height: 40, backgroundColor: colors["positive-subtle"], borderWidth: 2, borderColor: colors.ink ?? colors.border }}>
            <CalendarCheck size={20} color={colors.positive} strokeWidth={2} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-ui-semibold" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase", color: p?.confident ? colors.positive : colors["text-3"] }}>Next paycheque</Text>
            {safe.isLoading ? (
              <ActivityIndicator style={{ alignSelf: "flex-start" }} />
            ) : p?.confident ? (
              <>
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>
                  {payday(p.nextDate)} · about {hidden ? "••••••" : formatCents(Math.round(p.amount / 100) * 100)}
                </Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>From {p.label} · {CADENCE_LABEL[p.cadence]} · the last 3 landed on time</Text>
              </>
            ) : p ? (
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>Your pay from {p.label} hasn&apos;t landed on a steady schedule lately. Until it does, payday comes from your income schedule, or the end of the month.</Text>
            ) : (
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>No steady paycheque found yet. Set your pay&apos;s category to Income and turn on &quot;Always use&quot;. After three paydays, Tally predicts the next one.</Text>
            )}
          </View>
        </Card>

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
