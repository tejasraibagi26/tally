import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AlertTriangle, ChevronRight } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { safeToSpendLine } from "@tally/core/safeToSpend";
import type { SafeToSpendResult } from "@/lib/queries/safeToSpend";
import { MoneyText } from "@/components/ui/MoneyText";
import { Sheet } from "@/components/ui/Sheet";
import { useStickerShadow } from "@/components/ui/Card";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";

/*
 * Overview's Safe to spend card and its breakdown sheet (Tally Pop only):
 * mobile's copy of web's components/overview/SafeToSpend.tsx, from the same
 * GET /api/safe-to-spend and @tally/core/safeToSpend wording.
 */

const fmt = (c: number) => formatCents(c);

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function syncedAgo(iso: string | null): string {
  if (!iso) return "hasn't synced yet";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "last synced over a day ago";
  return `last synced ${days === 1 ? "a day" : `${days} days`} ago`;
}

/** Bills, card payments, cushion, then what's safe, as one meter. */
function Meter({ s }: { s: SafeToSpendResult }) {
  const colors = useThemeColors();
  const total = Math.max(s.cashTotal, s.billsTotal + s.cardsTotal + s.cushion, 1);
  const parts = [
    { key: "bills", cents: s.billsTotal, color: colors.text },
    { key: "cards", cents: s.cardsTotal, color: colors["border-strong"] },
    { key: "cushion", cents: s.cushion, color: colors["brand-border"] },
    { key: "safe", cents: Math.max(0, s.amount), color: colors.marigold ?? colors.positive },
  ].filter((p) => p.cents > 0);
  return (
    <View className="flex-row rounded-full overflow-hidden" style={{ height: 12, borderWidth: 2, borderColor: colors.ink ?? colors["border-strong"], backgroundColor: colors.surface }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {parts.map((p) => (
        <View key={p.key} style={{ flexGrow: p.cents / total, flexBasis: 0, backgroundColor: p.color }} />
      ))}
    </View>
  );
}

export function SafeToSpendCard({ s, initiallyOpen = false }: { s: SafeToSpendResult; /** Open the breakdown on arrival (an email's link). */ initiallyOpen?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const sticker = useStickerShadow();
  const [open, setOpen] = useState(initiallyOpen);
  const short = s.amount < 0;
  const line = safeToSpendLine(s, fmt);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-card border-card border-ink p-4 gap-2 active:opacity-90"
        style={[{ backgroundColor: short ? colors["negative-subtle"] : colors["brand-subtle"] }, sticker]}
        accessibilityRole="button"
        accessibilityLabel={`Safe to spend: ${fmt(s.amount)}. ${line.before}${line.emphasis}${line.after}. Opens the breakdown.`}
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>Safe to spend</Text>
          <ChevronRight size={17} color={colors.text} strokeWidth={2.4} />
        </View>
        <View className="flex-row items-baseline flex-wrap" style={{ columnGap: 10 }}>
          <MoneyText cents={s.amount} className={`font-display ${short ? "text-negative" : "text-text"}`} style={{ fontSize: rf(34), lineHeight: rf(38) }} />
        </View>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
          {line.before}
          <Text className="font-ui-semibold text-text">{line.emphasis}</Text>
          {line.after}
        </Text>
        {s.stale.length > 0 ? (
          <View className="self-start flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: colors["warning-subtle"], borderWidth: 2, borderColor: colors.ink ?? colors.warning }}>
            <AlertTriangle size={13} color={colors.warning} strokeWidth={2.4} />
            <Text className="font-ui-semibold" style={{ color: colors.warning, fontSize: rf(12) }}>
              {s.stale[0]!.name} {syncedAgo(s.stale[0]!.syncedAt)}
            </Text>
          </View>
        ) : (
          <Meter s={s} />
        )}
      </Pressable>
      <SafeToSpendSheet s={open ? s : null} onClose={() => setOpen(false)} />
    </>
  );
}

function SheetRow({ title, sub, cents, onPress, children }: { title: string; sub?: string; cents: number; onPress?: () => void; children?: React.ReactNode }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-start gap-3 py-2.5" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
      <View className="flex-1 gap-0.5 min-w-0">
        <Text className="font-ui text-text" style={{ fontSize: rf(14.5) }} numberOfLines={1}>{title}</Text>
        {sub && <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{sub}</Text>}
        {children}
      </View>
      <MoneyText cents={cents} className="text-text" style={{ fontSize: rf(14.5) }} />
    </Pressable>
  );
}

function SafeToSpendSheet({ s: next, onClose }: { s: SafeToSpendResult | null; onClose: () => void }) {
  const colors = useThemeColors();
  const sticker = useStickerShadow();
  const rf = useRF();
  const router = useRouter();
  // Keep the last result while the sheet slides away so it doesn't blank mid-animation.
  const shown = useRef<SafeToSpendResult | null>(next);
  if (next) shown.current = next;
  const s = shown.current;

  function go(href: Href) {
    onClose();
    router.push(href);
  }

  const step = (label: string, cents: number, strong = false) => (
    <View className="flex-row justify-between">
      <Text className={strong ? "font-ui-semibold text-text" : "font-ui text-text-2"} style={{ fontSize: rf(strong ? 14.5 : 13.5) }}>{label}</Text>
      <MoneyText cents={cents} className={strong ? "font-ui-semibold text-text" : "text-text-2"} style={{ fontSize: rf(strong ? 14.5 : 13.5) }} />
    </View>
  );
  const heading = (t: string) => (
    <Text className="font-display text-text" style={{ fontSize: rf(16), marginTop: 6 }}>{t}</Text>
  );

  return (
    <Sheet visible={next != null} onClose={onClose}>
      {s && (
        <ScrollView className="px-5" contentContainerStyle={{ paddingTop: 4, paddingBottom: 8, gap: 10 }}>
          <View className="gap-1">
            <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>Safe to spend</Text>
            <MoneyText cents={s.amount} className={`font-display ${s.amount < 0 ? "text-negative" : "text-text"}`} style={{ fontSize: rf(38), lineHeight: rf(42) }} />
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>
              Today – {shortDate(s.window.end)} · {s.window.days} day{s.window.days === 1 ? "" : "s"}
              {s.perDay != null ? ` · ~${fmt(Math.floor(s.perDay / 100) * 100)} a day` : ""}
            </Text>
          </View>

          {/* A sticker card like any other; the labels carry the minus, so the amounts are magnitudes. */}
          <View className="rounded-card border-card border-ink px-4 py-3 gap-1.5" style={[{ backgroundColor: colors["surface-2"] }, sticker]}>
            {step(`Cash in ${s.cash.length} account${s.cash.length === 1 ? "" : "s"}`, s.cashTotal)}
            {step("− Bills before payday", s.billsTotal)}
            {step("− Card payments due", s.cardsTotal)}
            {step("− Cushion", s.cushion)}
            <View style={{ height: 2, backgroundColor: colors.ink ?? colors["border-strong"], marginVertical: 3 }} />
            {step("Safe to spend", s.amount, true)}
          </View>

          {heading("Cash")}
          <View>
            {s.cash.map((a) => (
              <SheetRow key={a.id} title={a.name} cents={a.balance} onPress={() => go("/(tabs)/accounts")} />
            ))}
            {s.notCounted.length > 0 && (
              <Text className="font-ui text-text-3 pt-1" style={{ fontSize: rf(12.5) }}>
                {s.notCounted.map((a) => a.name).join(", ")} {s.notCounted.length === 1 ? "isn't" : "aren't"} counted. Savings stay separate.
              </Text>
            )}
          </View>

          {heading("Bills before payday")}
          {s.bills.length === 0 ? (
            <Text className="font-ui text-text-3" style={{ fontSize: rf(13.5) }}>None due before payday.</Text>
          ) : (
            <View>
              {s.bills.map((b) => (
                <SheetRow key={b.id} title={b.label} sub={b.overdue ? `Was due ${shortDate(b.dueDate)}` : shortDate(b.dueDate)} cents={b.amount} onPress={() => go("/subscriptions")} />
              ))}
            </View>
          )}

          {heading("Card payments due")}
          {s.cards.length === 0 ? (
            <Text className="font-ui text-text-3" style={{ fontSize: rf(13.5) }}>No statement due before payday.</Text>
          ) : (
            <View>
              {s.cards.map((c) => (
                <SheetRow key={c.accountId} title={c.label} sub={c.dueDate ? `Due ${shortDate(c.dueDate)}` : undefined} cents={c.amount} onPress={() => go(`/card/${c.accountId}` as Href)}>
                  {c.assumed && (
                    <View className="items-start gap-1 pt-1">
                      <Text className="font-ui-semibold rounded-full overflow-hidden px-2 py-0.5" style={{ fontSize: rf(11.5), color: colors.warning, backgroundColor: colors["warning-subtle"] }}>Assumed due before payday</Text>
                      <Pressable onPress={() => go("/safe-to-spend" as Href)} hitSlop={8}>
                        <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(12.5) }}>Add due day</Text>
                      </Pressable>
                    </View>
                  )}
                </SheetRow>
              ))}
            </View>
          )}

          {heading("Cushion")}
          <SheetRow title="Money you never want to dip below" cents={s.cushion} onPress={() => go("/safe-to-spend" as Href)} />

          <Pressable onPress={() => go("/safe-to-spend" as Href)} className="flex-row items-center justify-between pt-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
            <Text className="font-ui text-text-3 flex-1" style={{ fontSize: rf(12.5) }}>
              {s.payday.source === "paycheque" ? `Payday from ${s.payday.label} deposits` : s.payday.source === "schedule" ? "Payday from your income schedule" : "No payday found: counting to month end"}
            </Text>
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Settings</Text>
          </Pressable>
        </ScrollView>
      )}
    </Sheet>
  );
}
