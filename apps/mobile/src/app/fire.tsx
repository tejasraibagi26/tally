import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flame, Check } from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import { fireNumber, fireProgressPct, yearsToFire, ageAsOf, fireAgeAndYear, projectionSeries } from "@tally/core/fireMath";
import { formatPercent } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { ScreenHeader, ScreenBackButton, ScreenTitle } from "@/components/ui/ScreenHeader";
import { AppSlider } from "@/components/ui/AppSlider";
import { useFireDefaults, useFireSettings, useSaveFireSettings } from "@/lib/queries/fire";
import { useThemeColors } from "@/theme/useThemeColors";

// Matches apps/web/components/fire/FireCalculator.tsx: server-seeded
// defaults (investable net worth, trailing spend/contribution estimate,
// birthdate), a progress bar + tinted status banner, SWR/expected-return
// sliders, a yearly projection chart, and persisted assumptions -- the
// original mobile v1 of this screen was hardcoded $60k/$2k text inputs with
// no progress bar, banner, chart, or save, a much thinner port than the
// rest of the app's screens.
function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View className="gap-1.5" style={{ width: "48%" }}>
      <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
        {label}
      </Text>
      <View className="flex-row items-center h-12 rounded-control bg-surface-2 px-[14px]">
        <Text className="font-ui text-[13px] text-text-3 mr-1">$</Text>
        <TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" className="flex-1 font-ui text-[14.5px] text-text" />
      </View>
    </View>
  );
}

export default function FireCalculatorScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data: defaults, isLoading: loadingDefaults } = useFireDefaults();
  const { data: settingsData, isLoading: loadingSettings } = useFireSettings();
  const saveSettings = useSaveFireSettings();

  const [expensesInput, setExpensesInput] = useState("");
  const [contributionInput, setContributionInput] = useState("");
  const [swr, setSwr] = useState(0.04);
  const [expectedReturn, setExpectedReturn] = useState(0.07);
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed inputs once both the saved settings and the server defaults have
  // loaded. Expenses/contribution always come from the freshly computed
  // trailing-12-month default, never a stale saved override -- those two
  // are facts about actual spending, not tunable assumptions, so a change
  // in real spending should show up immediately instead of being shadowed
  // by whatever was true the last time "Save assumptions" was tapped. SWR
  // and expected return ARE genuine assumptions, so those still come from
  // saved settings when present.
  useEffect(() => {
    if (initialized || !defaults || settingsData === undefined) return;
    const settings = settingsData.settings;
    setExpensesInput(((defaults.defaultAnnualExpenses / 100) || 0).toFixed(0));
    setContributionInput(((defaults.defaultMonthlyContribution / 100) || 0).toFixed(0));
    setSwr(settings ? parseFloat(settings.swr) : 0.04);
    setExpectedReturn(settings ? parseFloat(settings.expectedReturn) : 0.07);
    setInitialized(true);
  }, [initialized, defaults, settingsData]);

  const annualExpenses = Math.round((parseFloat(expensesInput) || 0) * 100);
  const monthlyContribution = Math.round((parseFloat(contributionInput) || 0) * 100);
  const investableNetWorth = defaults?.investableNetWorth ?? 0;

  const { target, progress, years, alreadyThere, ageResult, chartData, horizonYears, endValue } = useMemo(() => {
    const target = fireNumber(annualExpenses, swr);
    const progress = fireProgressPct(investableNetWorth, target);
    const { years, alreadyThere } = yearsToFire({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate: expectedReturn, targetValue: target });
    const ageResult = defaults?.birthDate && years != null ? fireAgeAndYear(ageAsOf(defaults.birthDate, defaults.today), years, defaults.today) : null;
    const horizonYears = years != null ? Math.min(Math.max(Math.ceil(years) + 2, 5), 40) : 40;
    const points = projectionSeries({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate: expectedReturn, horizonYears });
    const chartData = points.map((p) => ({ value: p.projectedValue / 100 }));
    const endValue = points[points.length - 1]?.projectedValue ?? investableNetWorth;
    return { target, progress, years, alreadyThere, ageResult, chartData, horizonYears, endValue };
  }, [annualExpenses, swr, investableNetWorth, monthlyContribution, expectedReturn, defaults]);

  async function save() {
    setSaved(false);
    try {
      await saveSettings.mutateAsync({
        swr: swr.toString(),
        expectedReturn: expectedReturn.toString(),
        annualExpensesOverride: annualExpenses,
        monthlyContributionOverride: monthlyContribution,
      });
      setSaved(true);
    } catch {
      // mutation error state is enough feedback here -- no destructive path to guard
    }
  }

  if (loadingDefaults || loadingSettings || !initialized) {
    return (
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
        <ScreenGlow />
        <ScreenHeader title="FIRE Calculator" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (defaults && !defaults.hasAccounts) {
    return (
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
        <ScreenGlow />
        <ScreenHeader title="FIRE Calculator" />
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Flame size={28} color={colors["text-3"]} strokeWidth={1.5} />
          <Text className="font-ui-semibold text-[16px] text-text text-center">Connect an account to get started</Text>
          <Text className="font-ui text-[13.5px] text-text-2 text-center">
            The calculator uses your investable net worth and spending history to seed sensible defaults, which you can always adjust by hand.
          </Text>
        </View>
      </View>
    );
  }

  const barPct = Math.min(1, Math.max(0, progress));
  const bannerBg = alreadyThere ? "bg-positive-subtle" : years == null ? "bg-warning-subtle" : "bg-brand-subtle";
  const bannerText = alreadyThere ? "text-positive" : years == null ? "text-warning" : "text-text";

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
      <ScreenGlow />
      <ScreenBackButton />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
        <ScreenTitle
          title="FIRE Calculator"
          action={
            <Pressable
              onPress={save}
              disabled={saveSettings.isPending}
              className="h-9 px-4 rounded-full flex-row items-center gap-1.5 justify-center bg-brand disabled:opacity-50"
            >
              {saveSettings.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="font-ui-semibold text-[13px] text-on-brand">{saved ? "Saved" : "Save"}</Text>
                </>
              )}
            </Pressable>
          }
        />
        <Card className="p-5 gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
              FIRE number
            </Text>
            <MoneyText cents={target} className="font-display text-[26px] text-text" />
          </View>
          <View className="h-2 rounded-full bg-sunken overflow-hidden">
            <View className="h-full rounded-full bg-brand" style={{ width: `${barPct * 100}%` }} />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="font-ui text-[12px] text-text-3">
              <MoneyText cents={investableNetWorth} className="text-[12px] text-text-3" /> invested today
            </Text>
            <Text className="font-ui text-[12px] text-text-3">{formatPercent(progress || 0)} of the way there</Text>
          </View>
        </Card>

        <View className={`rounded-control px-4 py-3.5 ${bannerBg}`}>
          {alreadyThere ? (
            <Text className={`font-ui-medium text-[14.5px] ${bannerText}`}>You&apos;ve already hit your FIRE number 🎉</Text>
          ) : years == null ? (
            <Text className={`font-ui-medium text-[14.5px] ${bannerText}`}>Not reachable with these inputs. Raise the contribution or expected return.</Text>
          ) : (
            <View className="gap-1">
              <Text className={`font-ui-medium text-[14.5px] ${bannerText}`}>{years.toFixed(1)} years to FIRE at this pace</Text>
              {ageResult ? (
                <Text className="font-ui text-[12.5px] text-text-2">
                  You&apos;ll be {Math.round(ageResult.age)} in {ageResult.year}
                </Text>
              ) : (
                <Text className="font-ui text-[12.5px] text-text-3">Add your birthdate in Settings to see the age you&apos;ll hit this at, not just years away.</Text>
              )}
            </View>
          )}
        </View>

        {chartData.length > 1 && (
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-ui-semibold text-[13px] text-text-2" style={{ textTransform: "uppercase" }}>
                Projection
              </Text>
              <Text className="font-ui text-[11.5px] text-text-3">Now → {horizonYears}y</Text>
            </View>
            <Card className="p-4 pt-5 gap-2">
              <LineChart
                data={chartData}
                height={120}
                thickness={2.5}
                color={colors.brand}
                areaChart
                startFillColor={colors["brand-subtle"]}
                endFillColor={colors["brand-subtle"]}
                startOpacity={0.9}
                endOpacity={0.3}
                hideDataPoints
                hideYAxisText
                hideAxesAndRules
                curved
                initialSpacing={0}
                endSpacing={0}
              />
              <View className="flex-row items-center justify-between pt-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                <View className="gap-0.5">
                  <Text className="font-ui text-[10.5px] text-text-3">Today</Text>
                  <MoneyText cents={investableNetWorth} className="font-ui-semibold text-[13.5px] text-text" />
                </View>
                <View className="items-end gap-0.5">
                  <Text className="font-ui text-[10.5px] text-text-3">In {horizonYears} years</Text>
                  <MoneyText cents={endValue} className="font-ui-semibold text-[13.5px] text-text" />
                </View>
              </View>
            </Card>
          </View>
        )}

        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 16 }}>
          <Field label="Annual expenses" value={expensesInput} onChangeText={setExpensesInput} />
          <Field label="Monthly contribution" value={contributionInput} onChangeText={setContributionInput} />
        </View>

        <View className="gap-5">
          <View className="gap-2">
            <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
              Safe withdrawal rate: {formatPercent(swr)}
            </Text>
            <AppSlider value={swr} onValueChange={setSwr} min={0.01} max={0.1} step={0.001} tint={colors.brand} />
          </View>
          <View className="gap-2">
            <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
              Expected annual return: {formatPercent(expectedReturn)}
            </Text>
            <AppSlider value={expectedReturn} onValueChange={setExpectedReturn} min={-0.05} max={0.15} step={0.001} tint={colors.brand} />
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
