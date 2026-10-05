import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { useRouter } from "expo-router";
import { formatCents, formatPercent } from "@tally/core/money";
import { ageAsOf, fireMilestones, fireNumber, fireProgressPct, fireWhatIfs, projectionSeries, realReturn, requiredMonthlySaving, yearsToFire } from "@tally/core/fireMath";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { AppSlider } from "@/components/ui/AppSlider";
import { FireChart } from "@/components/charts/FireChart";
import { useFireDefaults, useFireSettings, useSaveFireSettings } from "@/lib/queries/fire";
import { usePlaidLink } from "@/lib/usePlaidLink";
import { hairline } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import { useThemeColors } from "@/theme/useThemeColors";

const DEFAULTS = { swr: 0.04, expectedReturn: 0.07, inflation: 0.02 };
const TARGET_AGE = 55;
const SAVE_DEBOUNCE_MS = 800;

function money(c: number): string {
  return formatCents(c).replace(/\.00$/, "");
}
function compact(c: number): string {
  const d = c / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(d) >= 1000) return `$${Math.round(d / 1000)}K`;
  return `$${Math.round(d)}`;
}
function pct1(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

interface Plan {
  swr: number;
  marketReturn: number;
  inflation: number;
  expenses: number;
  saving: number;
  excluded: string[];
}

// Mobile counterpart of apps/web/components/fire/FirePlanner.tsx: the
// answer first (age and year), a projection with the target and a ±1%
// band, what-ifs in years, milestones, and levers that save themselves.
// Projection runs on the return after inflation (@tally/core/fireMath).
export default function FireScreen() {
  const contentTop = useScreenContentTop();
  const { data: defaults, isLoading: loadingDefaults } = useFireDefaults();
  const { data: settingsData, isLoading: loadingSettings } = useFireSettings();
  const [startFromZero, setStartFromZero] = useState(false);

  if (loadingDefaults || loadingSettings || !defaults || settingsData === undefined) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center" style={{ paddingTop: contentTop }}>
        <ScreenGlow />
        <ActivityIndicator />
      </View>
    );
  }
  if ((defaults.accounts?.length ?? 0) === 0 && defaults.investableNetWorth === 0 && !startFromZero) {
    return <EmptyFire contentTop={contentTop} hasAccounts={defaults.hasAccounts} onStartFromZero={() => setStartFromZero(true)} />;
  }
  // Saved overrides win over the data-driven defaults; Planner owns edits from here.
  const s = settingsData.settings;
  const seed: Plan = {
    swr: s ? parseFloat(s.swr) : DEFAULTS.swr,
    marketReturn: s ? parseFloat(s.expectedReturn) : DEFAULTS.expectedReturn,
    inflation: s?.inflation != null ? parseFloat(s.inflation) : DEFAULTS.inflation,
    expenses: s?.annualExpensesOverride ?? defaults.defaultAnnualExpenses,
    saving: s?.monthlyContributionOverride ?? defaults.defaultMonthlyContribution,
    excluded: s?.excludedAccountIds ?? [],
  };
  return <Planner seed={seed} defaults={defaults} contentTop={contentTop} />;
}

function EmptyFire({ contentTop, hasAccounts, onStartFromZero }: { contentTop: number; hasAccounts: boolean; onStartFromZero: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const { openLink, isLinking } = usePlaidLink();
  return (
    <View className="flex-1 bg-canvas px-5" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <Card className="px-5 pt-6 pb-5 gap-3">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>When could you stop working?</Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
          {hasAccounts
            ? "Tally can work it out from your spending. Connect a brokerage so it also knows what you've invested, or start from $0."
            : "Connect your bank and brokerage, and Tally works it out from your spending and investments. Or start from $0."}
        </Text>
        <Pressable onPress={() => openLink("create")} disabled={isLinking} className="h-12 rounded-full items-center justify-center bg-brand mt-1">
          {isLinking ? <ActivityIndicator color={colors["on-brand"]} /> : <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14.5) }}>Connect a brokerage</Text>}
        </Pressable>
        <Pressable onPress={onStartFromZero} className="h-11 rounded-full items-center justify-center bg-brand-subtle">
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>Start from $0</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function Planner({
  seed,
  defaults,
  contentTop,
}: {
  seed: Plan;
  defaults: NonNullable<ReturnType<typeof useFireDefaults>["data"]>;
  contentTop: number;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
  const save = useSaveFireSettings();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const first = useRef(true);
  const [plan, setPlan] = useState<Plan>(seed);
  const set = (patch: Partial<Plan>) => setPlan((p) => ({ ...p, ...patch }));

  // Autosave, debounced; overrides only when they differ from the data default.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(() => {
      save.mutate(
        {
          swr: plan.swr,
          expectedReturn: plan.marketReturn,
          inflation: plan.inflation,
          annualExpensesOverride: plan.expenses === defaults.defaultAnnualExpenses ? null : plan.expenses,
          monthlyContributionOverride: plan.saving === defaults.defaultMonthlyContribution ? null : plan.saving,
          excludedAccountIds: plan.excluded,
        },
        { onSuccess: () => setSaveState("saved"), onError: () => setSaveState("error") },
      );
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const accounts = defaults.accounts ?? [];
  const excluded = new Set(plan.excluded);
  const invested = accounts.length ? accounts.filter((a) => !excluded.has(a.id)).reduce((s, a) => s + a.value, 0) : defaults.investableNetWorth;
  const r = realReturn(plan.marketReturn, plan.inflation);
  const age = defaults.birthDate ? ageAsOf(defaults.birthDate, defaults.today) : null;
  const startYear = new Date(`${defaults.today}T00:00:00`).getFullYear();
  const p = { currentValue: invested, monthlyContribution: plan.saving, annualReturnRate: r, annualExpenses: plan.expenses, swr: plan.swr };

  const v = useMemo(() => {
    const target = fireNumber(plan.expenses, plan.swr);
    const res = yearsToFire({ currentValue: invested, monthlyContribution: plan.saving, annualReturnRate: r, targetValue: target });
    const years = res.alreadyThere ? 0 : res.years;
    const horizon = Math.min(45, Math.max(10, Math.ceil((years ?? 30) + 3)));
    const series = (rate: number) => projectionSeries({ currentValue: invested, monthlyContribution: plan.saving, annualReturnRate: rate, horizonYears: horizon });
    return { target, res, years, mid: series(r), lo: series(r - 0.01), hi: series(r + 0.01), progress: fireProgressPct(invested, target) };
  }, [plan.expenses, plan.swr, plan.saving, invested, r]);
  const milestones = useMemo(() => fireMilestones(p, age), [p.currentValue, p.monthlyContribution, p.annualReturnRate, p.annualExpenses, p.swr, age]); // eslint-disable-line react-hooks/exhaustive-deps
  const whatIfs = useMemo(() => fireWhatIfs(p), [p.currentValue, p.monthlyContribution, p.annualReturnRate, p.annualExpenses, p.swr]); // eslint-disable-line react-hooks/exhaustive-deps

  const retireAge = age != null && v.years != null ? Math.floor(age + v.years) : null;
  const retireYear = v.years != null ? startYear + Math.round(v.years) : null;
  const yearsToTarget = age != null ? Math.max(1, TARGET_AGE - age) : 20;
  const needed = v.res.years == null && !v.res.alreadyThere ? Math.ceil(requiredMonthlySaving(invested, v.target, r, yearsToTarget) / 100) * 100 : null;
  const label = { fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" as const };
  const coveredMonths = defaults.coveredMonths ?? 12;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}>
          <Card className="overflow-hidden">
            <View className="px-5 pt-5 pb-3 gap-2">
              {v.res.alreadyThere ? (
                <>
                  <Text className="font-ui-medium text-text-3" style={label}>{"You've reached your number"}</Text>
                  <MoneyText cents={invested} className="font-display" style={{ fontSize: rf(38), color: colors.positive }} />
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                    {formatPercent(v.progress)} of {compact(v.target)}. At {pct1(plan.swr)} it supports {money(invested * plan.swr)} a year.
                  </Text>
                </>
              ) : v.years == null ? (
                <>
                  <Text className="font-ui-medium text-text-3" style={label}>At this pace</Text>
                  <Text className="font-display text-text" style={{ fontSize: rf(32) }}>Not reachable</Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                    With {money(plan.saving)} a month and {pct1(r)} after inflation, {compact(invested)} never grows to {compact(v.target)}.
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-ui-medium text-text-3" style={label}>{retireAge != null ? "You could retire at" : "You could retire in"}</Text>
                  <Text className="font-display text-text" style={{ fontSize: rf(40), lineHeight: rf(44) }}>
                    {retireAge != null ? `${retireAge} ` : `${retireYear}`}
                    {retireAge != null && <Text className="text-text-2" style={{ fontSize: rf(20) }}>in {retireYear}</Text>}
                  </Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                    {v.years.toFixed(1)} years away at your current pace
                    {retireAge == null ? " · add your birth date in Settings to see your age then" : ""}
                  </Text>
                </>
              )}
              <FireChart mid={v.mid} lo={v.lo} hi={v.hi} target={v.target} years={v.years} age={age} startYear={startYear} />
              <View className="flex-row gap-4">
                <View className="flex-row items-center gap-1.5">
                  <View style={{ width: 14, height: 2, backgroundColor: colors.brand }} />
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>Projected at {pct1(r)}</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: colors.brand, opacity: 0.25 }} />
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>±1% return</Text>
                </View>
              </View>
            </View>
            <View className="px-5 py-4 gap-2" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
              <View className="flex-row">
                <View className="flex-1 gap-1">
                  <Text className="font-ui-medium text-text-3" style={label}>Invested today</Text>
                  <MoneyText cents={invested} className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-ui-medium text-text-3" style={label}>FIRE number</Text>
                  <MoneyText cents={v.target} mask={false} className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} />
                </View>
              </View>
              <View className="h-2 rounded-full bg-sunken overflow-hidden">
                <View className="h-full bg-brand" style={{ width: `${Math.min(100, v.progress * 100)}%` }} />
              </View>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{formatPercent(v.progress)} of the way there</Text>
            </View>
          </Card>

          {needed != null && (
            <View className="flex-row items-center gap-3 rounded-[14px] bg-info-subtle pl-4 pr-3 py-3">
              <View className="flex-1 gap-0.5">
                <Text className="font-ui-semibold text-info" style={{ fontSize: rf(13.5) }}>To retire {age != null ? `at ${TARGET_AGE}` : `in ${yearsToTarget} years`}</Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>Save {money(needed)} a month at these returns.</Text>
              </View>
              <Pressable onPress={() => set({ saving: needed })} className="h-9 px-3.5 rounded-full items-center justify-center bg-brand-subtle">
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Use {money(needed)}</Text>
              </Pressable>
            </View>
          )}

          <Text className="font-ui-semibold text-text-3 px-1" style={label}>What if</Text>
          <View className="flex-row flex-wrap gap-2">
            {whatIfs
              .filter((w) => w.yearsSooner != null)
              .map((w) => (
                <View key={w.label} className="rounded-[10px] bg-surface-2 px-3 py-2" style={{ minWidth: "47%", flexGrow: 1 }}>
                  <Text className="font-ui-semibold" style={{ fontSize: rf(12.5), color: w.yearsSooner! >= 0 ? colors.positive : colors.negative }}>
                    {Math.abs(w.yearsSooner!).toFixed(1)} yr{Math.abs(w.yearsSooner!) >= 1.05 ? "s" : ""} {w.yearsSooner! >= 0 ? "sooner" : "later"}
                  </Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(12) }}>{w.label}</Text>
                </View>
              ))}
          </View>

          <View className="flex-row items-center justify-between px-1">
            <Text className="font-ui-semibold text-text-3" style={label}>Your levers</Text>
            <View className="flex-row items-center gap-3">
              <Text className="font-ui" style={{ fontSize: rf(12), color: saveState === "error" ? colors.negative : colors["text-3"] }}>
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Couldn't save" : ""}
              </Text>
              <Pressable
                onPress={() =>
                  set({ swr: DEFAULTS.swr, marketReturn: DEFAULTS.expectedReturn, inflation: DEFAULTS.inflation, expenses: defaults.defaultAnnualExpenses, saving: defaults.defaultMonthlyContribution, excluded: [] })
                }
                hitSlop={8}
              >
                <Text className="font-ui-medium text-brand" style={{ fontSize: rf(12.5) }}>Reset</Text>
              </Pressable>
            </View>
          </View>
          <Card className="p-5 gap-5">
            {coveredMonths > 0 && coveredMonths < 12 && (
              <Text className="font-ui text-text-2 rounded-control bg-info-subtle px-3 py-2" style={{ fontSize: rf(12) }}>
                Spending is an estimate: only {coveredMonths} month{coveredMonths === 1 ? "" : "s"} of history so far, scaled up to a year.
              </Text>
            )}
            <Lever
              label="Monthly saving"
              value={plan.saving}
              display={money(plan.saving)}
              min={0}
              max={Math.max(1_000_000, defaults.defaultMonthlyContribution * 3, plan.saving)}
              step={5000}
              money
              onChange={(saving) => set({ saving })}
              hint={plan.saving === defaults.defaultMonthlyContribution ? "Last 12 months: income minus spending" : undefined}
              reset={plan.saving !== defaults.defaultMonthlyContribution ? { label: `Use actual (${money(defaults.defaultMonthlyContribution)})`, run: () => set({ saving: defaults.defaultMonthlyContribution }) } : undefined}
            />
            <Lever
              label="Yearly spending in retirement"
              value={plan.expenses}
              display={money(plan.expenses)}
              min={0}
              max={Math.max(20_000_000, defaults.defaultAnnualExpenses * 3, plan.expenses)}
              step={50000}
              money
              onChange={(expenses) => set({ expenses })}
              hint={plan.expenses === defaults.defaultAnnualExpenses ? "Your last 12 months, in today's dollars" : undefined}
              reset={plan.expenses !== defaults.defaultAnnualExpenses ? { label: `Use actual (${money(defaults.defaultAnnualExpenses)})`, run: () => set({ expenses: defaults.defaultAnnualExpenses }) } : undefined}
            />
            <Lever label="Market return" value={plan.marketReturn} display={pct1(plan.marketReturn)} min={-0.02} max={0.12} step={0.0025} onChange={(marketReturn) => set({ marketReturn })} />
            <Lever label="Inflation" value={plan.inflation} display={pct1(plan.inflation)} min={0} max={0.06} step={0.0025} onChange={(inflation) => set({ inflation })} hint={`Return after inflation: ${pct1(r)}`} />
            <Lever label="Withdrawal rate" value={plan.swr} display={pct1(plan.swr)} min={0.025} max={0.06} step={0.0025} onChange={(swr) => set({ swr })} hint={`Target = spending ÷ ${pct1(plan.swr)} = ${compact(v.target)}`} />
            {accounts.length > 0 && (
              <View className="gap-2 pt-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
                <Pressable onPress={() => setAccountsOpen((o) => !o)} className="flex-row justify-between">
                  <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(12.5) }}>
                    Invested today counts {accounts.filter((a) => !excluded.has(a.id)).length} of {accounts.length} accounts
                  </Text>
                  <Text className="font-ui-medium text-brand" style={{ fontSize: rf(12.5) }}>{accountsOpen ? "Done" : "Choose"}</Text>
                </Pressable>
                {accountsOpen &&
                  accounts.map((a) => (
                    <View key={a.id} className="flex-row items-center justify-between gap-3">
                      <Text className="font-ui text-text flex-1" style={{ fontSize: rf(13.5) }} numberOfLines={1}>{a.name}</Text>
                      <MoneyText cents={a.value} className="font-ui text-text-3" style={{ fontSize: rf(12.5) }} />
                      <Switch
                        value={!excluded.has(a.id)}
                        onValueChange={(on) => set({ excluded: on ? plan.excluded.filter((id) => id !== a.id) : [...plan.excluded, a.id] })}
                        trackColor={{ true: colors.brand, false: colors["surface-2"] }}
                        accessibilityLabel={`Count ${a.name}`}
                      />
                    </View>
                  ))}
              </View>
            )}
          </Card>

          <Text className="font-ui-semibold text-text-3 px-1" style={label}>Milestones</Text>
          <Card className="px-5 py-1">
            {milestones.map((m, i) => (
              <View key={m.key} className="flex-row items-center gap-3 py-3" style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
                <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: m.reached ? colors.positive : colors["text-3"], backgroundColor: m.reached ? colors.positive : "transparent" }} />
                <View className="flex-1">
                  <Text className="font-ui text-text" style={{ fontSize: rf(13.5) }}>
                    {m.label} <Text className="text-text-3">· {compact(m.value)}</Text>
                  </Text>
                  {m.detail && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{m.detail}</Text>}
                </View>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>
                  {m.reached ? "Reached" : m.years == null ? "—" : startYear + Math.round(m.years)}
                </Text>
              </View>
            ))}
          </Card>
          {age == null && (
            <Pressable onPress={() => router.push("/settings")} className="items-center py-1">
              <Text className="font-ui-medium text-brand" style={{ fontSize: rf(13) }}>Add your birth date to see ages</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Lever({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  money: isMoney,
  hint,
  reset,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  money?: boolean;
  hint?: string;
  reset?: { label: string; run: () => void };
}) {
  const rf = useRF();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  function commit() {
    const n = parseFloat(draft.replace(/[$,%\s]/g, ""));
    if (Number.isFinite(n)) onChange(isMoney ? Math.round(n * 100) : n / 100);
    setEditing(false);
  }
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>{label}</Text>
        {editing ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            className="font-ui-semibold text-text rounded-[6px] bg-surface-2 px-2"
            style={{ fontSize: rf(14), minWidth: 90, textAlign: "right", paddingVertical: 4 }}
          />
        ) : (
          <Pressable
            onPress={() => {
              setDraft(isMoney ? String(Math.round(value / 100)) : (value * 100).toFixed(2).replace(/\.?0+$/, ""));
              setEditing(true);
            }}
            hitSlop={8}
            accessibilityLabel={`${label}: ${display}. Tap to type a value`}
          >
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(14.5), fontVariant: ["tabular-nums"] }}>{display}</Text>
          </Pressable>
        )}
      </View>
      <AppSlider value={Math.min(max, Math.max(min, value))} onValueChange={onChange} min={min} max={max} step={step} />
      {reset ? (
        <Pressable onPress={reset.run} hitSlop={6}>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>
            Your own amount · <Text className="font-ui-medium text-brand">{reset.label}</Text>
          </Text>
        </Pressable>
      ) : hint ? (
        <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{hint}</Text>
      ) : null}
    </View>
  );
}
