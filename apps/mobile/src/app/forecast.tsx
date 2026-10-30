import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AlertTriangle, Info } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { FORECAST_RANGES, type ForecastDay, type ForecastEvent, type ForecastRange } from "@tally/core/forecast";
import { Card } from "@/components/ui/Card";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { ForecastHowItWorksDialog } from "@/components/forecast/ForecastHowItWorksDialog";
import { MerchantAvatar } from "@/components/transactions/MerchantAvatar";
import { useForecast } from "@/lib/queries/forecast";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Forecast (reached from the More sheet and Overview's card): mobile's
 * counterpart of web's /forecast. Same API, same wording, same headline
 * rule — the first day under the buffer, not the deepest.
 */
export default function ForecastScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { hidden } = usePrivacy();
  const [range, setRange] = useState<ForecastRange | undefined>(undefined);
  const [howOpen, setHowOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const forecast = useForecast(range);

  const f = forecast.data;
  const money = (c: number) => (hidden ? "••••" : formatCents(c));
  const h = f?.headline ?? null;
  const short = h?.kind === "shortfall";

  if (forecast.isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color={colors["text-3"]} />
      </View>
    );
  }

  if (!f || (f.openingCash === 0 && f.assumptions.paycheques === 0)) {
    return (
      <ScrollView className="flex-1 bg-canvas" contentContainerStyle={{ paddingTop: contentTop, paddingHorizontal: 20, paddingBottom: 40 }}>
        <ScreenGlow />
        <Card className="p-5">
          <Text className="font-display text-text" style={{ fontSize: rf(17) }}>Nothing to forecast yet</Text>
          <Text className="font-ui text-text-2 mt-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
            Tally needs a chequing account to start from. Connect one and your bills, pay dates and card statements fill in the rest.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  // The ledger is long; mobile shows the near end and expands to the rest.
  const visible = showAll ? f.events : f.events.slice(0, 12);

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        scrollEnabled={!scrubbing}
        contentContainerStyle={{ paddingTop: contentTop, paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
      >
        <ScreenGlow />

        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-1.5">
            {FORECAST_RANGES.map((days) => {
              const on = days === f.range;
              return (
                <Pressable
                  key={days}
                  onPress={() => setRange(days)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${days} days`}
                  className={`rounded-full border-button px-3 py-1 ${on ? "bg-brand border-ink" : "bg-surface border-ink"}`}
                >
                  <Text className="font-ui-semibold" style={{ fontSize: rf(12.5), color: on ? colors["on-brand"] : colors.text, fontVariant: ["tabular-nums"] }}>
                    {days}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => setHowOpen(true)} hitSlop={10} accessibilityRole="button" className="flex-row items-center gap-1.5 active:opacity-70">
            <Info size={15} color={colors["text-2"]} strokeWidth={2} />
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>How it works</Text>
          </Pressable>
        </View>

        {/* Headline */}
        <Card className="p-4">
          {h == null ? (
            <>
              <Text className="font-display text-text" style={{ fontSize: rf(16) }}>Set your pay schedule</Text>
              <Text className="font-ui text-text-2 mt-1.5" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
                Tally can plot your bills, but not where you land without knowing when you get paid.
              </Text>
            </>
          ) : (
            <>
              <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(10.5), letterSpacing: 0.7, textTransform: "uppercase" }}>
                {short ? "First short day" : "Lowest point"}
              </Text>
              <Text
                className="font-display mt-1"
                style={{ fontSize: rf(31), color: h.amount < 0 ? colors.negative : colors.text, fontVariant: ["tabular-nums"] }}
              >
                {money(h.amount)}
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(13.5) }}>{dayLabel(h.date)}</Text>
                {short && (
                  <View className="flex-row items-center gap-1 rounded-full bg-negative-subtle px-2 py-0.5" style={{ borderWidth: 1.5, borderColor: colors.negative }}>
                    <AlertTriangle size={11} color={colors.negative} strokeWidth={2.5} />
                    <Text className="font-ui-semibold" style={{ fontSize: rf(11), color: colors.negative }}>
                      {Math.round((Date.parse(`${h.date}T00:00:00Z`) - Date.parse(`${f.today}T00:00:00Z`)) / 86_400_000)} days
                    </Text>
                  </View>
                )}
              </View>
              {h.causes.length > 0 && (
                <Text className="font-ui text-text-2 mt-2" style={{ fontSize: rf(12.5), lineHeight: rf(18) }}>
                  {h.causes.map((c) => `${c.label} (${money(c.amount)})`).join(" and ")} {h.causes.length === 1 ? "comes" : "come"} out first.
                </Text>
              )}
              {!short && f.bandBreach && (
                <Text className="font-ui text-text-2 mt-2" style={{ fontSize: rf(12.5), lineHeight: rf(18) }}>
                  A heavier fortnight than usual could still put you under {money(f.cushion)} around {dayLabel(f.bandBreach.date)}.
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Chart */}
        <Card className="px-4 pt-4 pb-3">
          <Text className="font-display text-text mb-2" style={{ fontSize: rf(15) }}>Projected balance</Text>
          <ForecastChart
            days={f.days}
            events={f.events}
            cushion={f.cushion}
            shortfallDate={short ? h.date : null}
            onScrubbingChange={setScrubbing}
          />
        </Card>

        {/* Ledger */}
        <Card className="px-4 pt-3 pb-2">
          <Text className="font-display text-text" style={{ fontSize: rf(15) }}>What&apos;s coming</Text>
          <Ledger events={visible} days={f.days} today={f.today} cushion={f.cushion} money={money} />
          {f.events.length > visible.length && (
            <Pressable onPress={() => setShowAll(true)} hitSlop={6} accessibilityRole="button" className="py-3 active:opacity-70">
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(12.5) }}>
                Show {f.events.length - visible.length} more through {dayLabel(f.days.at(-1)!.date)}
              </Text>
            </Pressable>
          )}
          {f.events.length === 0 && (
            <Text className="font-ui text-text-2 py-5 text-center" style={{ fontSize: rf(13) }}>
              Nothing scheduled in this window. Bills come from Subscriptions.
            </Text>
          )}
        </Card>

        {/* Assumptions, read-only here: the override lives on web. */}
        <Card className="px-4 py-3">
          <Text className="font-display text-text mb-1" style={{ fontSize: rf(15) }}>Assumptions</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5), lineHeight: rf(18) }}>
            {f.assumptions.source === "none"
              ? `A spending estimate needs about 30 days of history; Tally has ${f.assumptions.historyDays}.`
              : `Spending about ${money(f.assumptions.dailySpendCents)} a day${f.assumptions.source === "override" ? " (your figure)" : ", the middle of the last " + f.assumptions.historyDays + " days"}.`}
            {" "}
            {f.assumptions.paycheques} paycheque{f.assumptions.paycheques === 1 ? "" : "s"} and {f.assumptions.bills} bill
            {f.assumptions.bills === 1 ? "" : "s"} ahead.
            {f.cushion > 0 ? ` Buffer ${money(f.cushion)}.` : ""}
          </Text>
          {f.assumptions.stale.length > 0 && (
            <Text className="font-ui mt-1.5" style={{ fontSize: rf(12.5), color: colors.warning }}>
              {f.assumptions.stale.map((s) => s.name).join(", ")} hasn&apos;t synced today, so the curve starts from an old balance.
            </Text>
          )}
          <Pressable onPress={() => router.push("/subscriptions" as Href)} hitSlop={8} className="mt-2 active:opacity-70">
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(12.5) }}>Manage bills →</Text>
          </Pressable>
        </Card>
      </ScrollView>
      <ForecastHowItWorksDialog open={howOpen} onClose={() => setHowOpen(false)} />
    </>
  );
}

/** Where a row goes when tapped: the thing that made it, as on web. */
function hrefFor(e: ForecastEvent): Href {
  if (e.kind === "card") return `/card/${e.sourceId}` as Href;
  if (e.kind === "income") return "/income-schedules" as Href;
  return "/subscriptions" as Href;
}

function tile(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    day: String(d.getUTCDate()),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase(),
  };
}

/**
 * Web's components/forecast/ForecastLedger.tsx on mobile: one block per day,
 * a date tile centred beside the day's events, and the balance the day
 * leaves behind written once under them. A card-only day doesn't move cash
 * and has no balance; a day under the buffer says so in words beside it.
 */
function Ledger({
  events,
  days,
  today,
  cushion,
  money,
}: {
  events: ForecastEvent[];
  days: ForecastDay[];
  today: string;
  cushion: number;
  money: (c: number) => string;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const balanceOn = new Map(days.map((d) => [d.date, d.balance]));

  // Anything in the grace window lands on day 0, as it does in the curve.
  const groups: { date: string; events: ForecastEvent[] }[] = [];
  for (const e of events) {
    const date = e.date < today ? today : e.date;
    const last = groups.at(-1);
    if (last?.date === date) last.events.push(e);
    else groups.push({ date, events: [e] });
  }

  return (
    <View>
      {groups.map((g, gi) => {
        const t = tile(g.date);
        const isToday = g.date === today;
        const after = g.events.some((e) => e.affectsCash) ? balanceOn.get(g.date) : undefined;
        const short = after != null && after < cushion;
        const tileText = isToday ? colors.brand : colors["text-3"];
        return (
          <View
            key={g.date}
            className="flex-row gap-3 py-3"
            style={gi < groups.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
          >
            <View
              accessible
              accessibilityLabel={isToday ? "Today" : dayLabel(g.date)}
              className="items-center rounded-lg py-1.5"
              style={{
                alignSelf: "center",
                width: 42,
                borderWidth: 1,
                borderColor: isToday ? colors.brand : colors.border,
                backgroundColor: isToday ? colors["brand-subtle"] : colors["surface-2"],
              }}
            >
              <Text className="font-ui-semibold" style={{ fontSize: rf(9.5), letterSpacing: 0.6, color: tileText }}>
                {isToday ? "TODAY" : t.weekday}
              </Text>
              <Text className="font-ui-semibold" style={{ fontSize: rf(17), marginTop: 1, color: isToday ? colors.brand : colors.text, fontVariant: ["tabular-nums"] }}>
                {t.day}
              </Text>
              <Text className="font-ui-semibold" style={{ fontSize: rf(9.5), letterSpacing: 0.6, color: tileText }}>
                {t.month}
              </Text>
            </View>

            <View className="flex-1">
              {g.events.map((e) => (
                <Pressable
                  key={`${e.sourceId}-${e.date}-${e.label}`}
                  onPress={() => router.push(hrefFor(e))}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2.5 py-1.5 active:opacity-70"
                >
                  <View style={{ opacity: e.affectsCash ? 1 : 0.6 }}>
                    <MerchantAvatar name={e.label} size={28} radius={8} fontSize={12} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="font-ui-medium shrink" numberOfLines={1} style={{ fontSize: rf(14), color: e.affectsCash ? colors.text : colors["text-3"] }}>
                        {e.label}
                      </Text>
                      {e.modelled && (
                        <View className="rounded-full px-1.5" style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors["border-strong"] }}>
                          <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(10.5) }}>projected</Text>
                        </View>
                      )}
                    </View>
                    {(e.date < today || !e.affectsCash) && (
                      <Text
                        className={e.date < today ? "font-ui-medium" : "font-ui"}
                        numberOfLines={1}
                        style={{ fontSize: rf(11.5), color: e.date < today ? colors.warning : colors["text-3"] }}
                      >
                        {e.date < today ? `Overdue · was ${dayLabel(e.date)}` : "On a card · paid with its statement"}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="font-ui-semibold"
                    style={{ fontSize: rf(14), fontVariant: ["tabular-nums"], color: e.amount > 0 ? colors.positive : e.affectsCash ? colors.negative : colors["text-3"] }}
                  >
                    {e.amount > 0 ? "+" : ""}
                    {money(e.amount)}
                  </Text>
                </Pressable>
              ))}

              {after != null && (
                <View className="flex-row items-center justify-end flex-wrap gap-x-2 mt-1">
                  {short && (
                    <View className="flex-row items-center gap-1">
                      <AlertTriangle size={12} color={colors.negative} strokeWidth={2.5} />
                      <Text className="font-ui-semibold" style={{ fontSize: rf(12), color: colors.negative }}>Under your {money(cushion)} buffer</Text>
                    </View>
                  )}
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>Balance after</Text>
                  <Text className="font-ui-semibold" style={{ fontSize: rf(12), fontVariant: ["tabular-nums"], color: after < 0 ? colors.negative : colors.text }}>
                    {money(after)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
