import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { formatCents, formatPercent } from "@tally/core/money";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sheet } from "@/components/ui/Sheet";
import { CardTile } from "@/components/cards/CardTile";
import { MerchantAvatar } from "@/components/transactions/MerchantAvatar";
import { useLiabilities, useSetCreditLimit } from "@/lib/queries/liabilities";
import { useTransactions } from "@/lib/queries/transactions";
import { cardRows, shortDate, type CardRowData } from "@/lib/cards";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";

const APR_TYPE_LABEL: Record<string, string> = {
  purchase_apr: "Purchase",
  cash_apr: "Cash advance",
  balance_transfer_apr: "Balance transfer",
  special: "Special",
};

/**
 * One credit card: balance and utilization, this statement's cycle (closed,
 * paid, due) with the four numbers that matter, charges since it closed,
 * interest rates, and the card's limit and name. Plain sections with
 * hairlines -- no boxed cards inside the page.
 */
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const rf = useRF();
  const colors = useThemeColors();
  const contentTop = useScreenContentTop();
  const { hidden } = usePrivacy();
  const { data, isLoading } = useLiabilities();
  const row = cardRows(data?.cards ?? [], data?.institutions).find((r) => r.card.accountId === id) ?? null;
  const [limitOpen, setLimitOpen] = useState(false);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <Stack.Screen options={{ headerTitle: row?.displayName ?? "Card" }} />
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 26, paddingBottom: 40 }}>
        {isLoading || !row ? (
          isLoading ? (
            <View className="gap-3">
              <Skeleton style={{ width: 88, height: 56, borderRadius: 12 }} />
              <Skeleton style={{ width: 200, height: 40 }} />
              <Skeleton style={{ height: 160, borderRadius: 16, marginTop: 8 }} />
            </View>
          ) : (
            <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>This card isn't connected anymore.</Text>
          )
        ) : (
          <>
            <Header row={row} hidden={hidden} />
            {row.needsFix && (
              <Pressable onPress={() => router.push("/(tabs)/accounts")} className="rounded-control px-4 py-3" style={{ backgroundColor: colors["negative-subtle"] }}>
                <Text className="font-ui-semibold" style={{ fontSize: rf(13.5), color: colors.negative }}>This card's bank needs you</Text>
                <Text className="font-ui text-text-2 mt-0.5" style={{ fontSize: rf(12.5) }}>Numbers are from the last sync. Reconnect on Accounts ›</Text>
              </Pressable>
            )}
            <Statement row={row} hidden={hidden} />
            <Charges row={row} hidden={hidden} />
            {(row.card.liability?.aprs?.length ?? 0) > 0 && (
              <Section title="Interest rates">
                {row.card.liability!.aprs!.map((a, i) => (
                  <Line key={a.apr_type} first={i === 0} label={APR_TYPE_LABEL[a.apr_type] ?? a.apr_type} value={`${a.apr_percentage.toFixed(2)}%`} />
                ))}
              </Section>
            )}
            <Section title="Card">
              <Line first label="Credit limit" value={row.card.creditLimit != null ? `${formatCents(row.card.creditLimit)} · ${row.card.creditLimitIsManual ? "set by you" : `from ${row.bankName}`}` : "Not reported · Add"} onPress={row.card.creditLimit == null || row.card.creditLimitIsManual ? () => setLimitOpen(true) : undefined} />
              <Line label="Bank" value={row.bankName} />
            </Section>
          </>
        )}
      </ScrollView>
      {row && <LimitSheet row={row} visible={limitOpen} onClose={() => setLimitOpen(false)} />}
    </View>
  );
}

function Header({ row, hidden }: { row: CardRowData; hidden: boolean }) {
  const rf = useRF();
  const colors = useThemeColors();
  const v = row.view;
  const c = row.card;
  const barColor = v.utilizationTone === "over" ? colors.negative : v.utilizationTone === "high" ? colors.warning : colors.brand;
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <CardTile bankName={row.bankName} color={row.color} logo={row.logo} network={c.network} size="lg" mask={c.mask} />
        <View className="flex-1 min-w-0">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} numberOfLines={1}>{row.displayName}</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{row.bankName}</Text>
        </View>
      </View>
      <View className="gap-1.5">
        <Text className="font-display" style={{ fontSize: rf(40), lineHeight: rf(44), fontVariant: ["tabular-nums"], color: c.currentBalance < 0 ? colors.positive : colors.text }}>
          {hidden ? "$•••••" : c.currentBalance < 0 ? `${formatCents(-c.currentBalance)} credit` : formatCents(c.currentBalance)}
        </Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
          {v.utilization != null
            ? `${formatPercent(v.utilization)} of your ${hidden ? "" : `${formatCents(c.creditLimit ?? 0)} `}limit${c.creditLimitIsManual ? " · set by you" : ""}`
            : "No limit reported"}
        </Text>
        {v.utilization != null && (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.sunken, marginTop: 4 }}>
            <View style={{ width: `${Math.min(1, Math.max(0, v.utilization)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: barColor }} />
            <View style={{ position: "absolute", left: "30%", top: -2, bottom: -2, width: 1.5, backgroundColor: colors.text, opacity: 0.4 }} />
          </View>
        )}
      </View>
    </View>
  );
}

function Statement({ row, hidden }: { row: CardRowData; hidden: boolean }) {
  const rf = useRF();
  const colors = useThemeColors();
  const v = row.view;
  const l = row.card.liability;
  if (!l?.lastStatementIssueDate) {
    return (
      <Section title="This statement">
        <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
          {l ? "No statement yet. New cards get one after their first cycle." : "Your bank hasn't sent statement details for this card yet."}
        </Text>
      </Section>
    );
  }
  const money = (c: number | null | undefined) => (c == null ? "—" : hidden ? "•••••" : formatCents(c));
  const steps = [
    { label: "Closed", sub: shortDate(l.lastStatementIssueDate), done: true },
    { label: v.paid > 0 ? `Paid ${money(v.paid)}` : "Not paid yet", sub: v.state === "paid" ? "In full" : v.minimumMet ? "Minimum covered" : "", done: v.paid > 0 },
    { label: "Due", sub: l.nextPaymentDueDate ? shortDate(l.nextPaymentDueDate) : "—", done: v.state === "paid" },
  ];
  return (
    <Section title="This statement">
      <View className="flex-row items-center px-1 mt-1">
        {steps.map((s, i) => (
          <View key={i} className="flex-row items-center" style={{ flex: i === 0 ? 0 : 1 }}>
            {i > 0 && <View style={{ flex: 1, height: 2, backgroundColor: s.done ? colors.positive : colors.border }} />}
            <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: s.done ? colors.positive : colors["text-3"], backgroundColor: s.done ? colors.positive : colors.canvas }} />
          </View>
        ))}
      </View>
      <View className="flex-row justify-between px-1 mt-2">
        {steps.map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: i === 0 ? "flex-start" : i === 1 ? "center" : "flex-end" }}>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(11.5) }}>{s.label}</Text>
            {!!s.sub && <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>{s.sub}</Text>}
          </View>
        ))}
      </View>
      <View className="mt-3">
        <Line first label="Statement balance" value={money(l.lastStatementBalance)} />
        <Line label="Paid so far" value={money(v.paid)} />
        <Line label="Left to avoid interest" value={money(v.left)} strong />
        <Line label="Minimum" value={l.minimumPaymentAmount == null ? "Unknown" : v.minimumMet ? "✓ Covered" : money(l.minimumPaymentAmount)} tone={v.minimumMet ? colors.positive : undefined} />
      </View>
      {v.left != null && v.left > 0 && l.nextPaymentDueDate && !hidden && (
        <Text className="font-ui text-text-2 px-1 mt-1" style={{ fontSize: rf(12.5), lineHeight: rf(18) }}>
          Paying {formatCents(v.left)} by {shortDate(l.nextPaymentDueDate)} usually means no interest on purchases.
        </Text>
      )}
    </Section>
  );
}

function Charges({ row, hidden }: { row: CardRowData; hidden: boolean }) {
  const rf = useRF();
  const colors = useThemeColors();
  const router = useRouter();
  const from = row.card.liability?.lastStatementIssueDate ?? null;
  const filters: Record<string, string> = { account: row.card.accountId, ...(from ? { from, to: new Date().toISOString().slice(0, 10) } : {}) };
  const { data, isLoading } = useTransactions(filters);
  const items = data?.pages[0]?.items.slice(0, 5) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;
  return (
    <Section title={from ? "Since the statement" : "Recent charges"}>
      {isLoading ? (
        <View className="gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 36, borderRadius: 10 }} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text className="font-ui text-text-3 px-1" style={{ fontSize: rf(13.5) }}>No charges yet this cycle.</Text>
      ) : (
        <>
          {items.map((t, i) => {
            const name = t.merchantName ?? t.name;
            return (
              <Pressable key={t.id} onPress={() => router.push(`/(tabs)/transactions/${t.id}`)} className="flex-row items-center gap-3 px-1" style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: hairline(colors) }}>
                <MerchantAvatar name={name} logoUrl={t.isTransfer || t.isManual ? null : t.logoUrl} size={28} radius={8} fontSize={11.5} />
                <Text className="font-ui text-text flex-1" style={{ fontSize: rf(14) }} numberOfLines={1}>{name}</Text>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{new Date(t.postedDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</Text>
                <Text className="font-ui-medium" style={{ fontSize: rf(14), fontVariant: ["tabular-nums"], color: t.amount > 0 ? colors.positive : colors.text, minWidth: 72, textAlign: "right" }}>
                  {hidden ? "•••" : formatCents(t.amount, { signed: true })}
                </Text>
              </Pressable>
            );
          })}
          {total > items.length && (
            <Pressable
              onPress={() => router.push(`/(tabs)/transactions?account=${row.card.accountId}${from ? `&from=${from}` : ""}` as Href)}
              className="px-1 pt-2"
              hitSlop={8}
            >
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>All {total} ›</Text>
            </Pressable>
          )}
        </>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="gap-1">
      <Text className="font-ui-semibold text-text-3 px-1 mb-1" style={{ fontSize: rf(11), letterSpacing: 0.7, textTransform: "uppercase" }}>{title}</Text>
      {children}
    </View>
  );
}

function Line({ label, value, first, strong, tone, onPress }: { label: string; value: string; first?: boolean; strong?: boolean; tone?: string; onPress?: () => void }) {
  const rf = useRF();
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-baseline justify-between gap-4 px-1" style={{ paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: hairline(colors) }}>
      <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>{label}</Text>
      <View className="flex-row items-center gap-1 flex-shrink">
        <Text className={strong ? "font-ui-semibold" : "font-ui"} style={{ fontSize: rf(14), fontVariant: ["tabular-nums"], color: tone ?? (onPress ? colors.brand : colors.text), textAlign: "right" }}>{value}</Text>
        {onPress && <ChevronRight size={14} color={colors.brand} />}
      </View>
    </Pressable>
  );
}

/** Add or change a limit you entered by hand. Bottom = the sheet's safe-area offset only. */
function LimitSheet({ row, visible, onClose }: { row: CardRowData; visible: boolean; onClose: () => void }) {
  const rf = useRF();
  const colors = useThemeColors();
  const setLimit = useSetCreditLimit(row.card.accountId);
  const [text, setText] = useState(row.card.creditLimit != null ? (row.card.creditLimit / 100).toFixed(0) : "");
  const [error, setError] = useState<string | null>(null);
  const dollars = parseFloat(text);
  const valid = Number.isFinite(dollars) && dollars > 0;
  const preview = valid && row.card.currentBalance > 0 ? row.card.currentBalance / 100 / dollars : null;

  async function save(value: number | null) {
    setError(null);
    try {
      await setLimit.mutateAsync(value);
      onClose();
    } catch {
      setError("Couldn't save the limit. Try again.");
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="px-5 pt-1 gap-4">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="font-ui text-brand" style={{ fontSize: rf(15) }}>Cancel</Text>
          </Pressable>
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>Credit limit</Text>
          <Pressable onPress={() => valid && void save(dollars)} disabled={!valid || setLimit.isPending} hitSlop={8}>
            <Text className="font-ui-semibold" style={{ fontSize: rf(15), color: valid ? colors.brand : colors["text-3"] }}>{setLimit.isPending ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
          {row.displayName}
          {row.card.mask ? ` ••${row.card.mask}` : ""} · {row.card.creditLimitIsManual ? "a limit you set" : `${row.bankName} didn't report a limit`}
        </Text>
        <View className="flex-row items-center rounded-control px-4" style={{ backgroundColor: colors["surface-2"], height: 56 }}>
          <Text className="font-display text-text-3" style={{ fontSize: rf(28) }}>$</Text>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            autoFocus
            placeholder="0"
            placeholderTextColor={colors["text-3"]}
            className="flex-1 font-display text-text"
            style={{ fontSize: rf(28), paddingVertical: 0, marginLeft: 4 }}
            accessibilityLabel="Credit limit in dollars"
          />
        </View>
        {preview != null && (
          <Text className="font-ui text-text-2" style={{ fontSize: rf(13), lineHeight: rf(18) }}>
            Your balance is {formatPercent(preview)} of this. Adding it counts this card in Credit used on Overview.
          </Text>
        )}
        {error && <Text className="font-ui" style={{ fontSize: rf(13), color: colors.negative }}>{error}</Text>}
        {row.card.creditLimitIsManual && (
          <Pressable onPress={() => void save(null)} disabled={setLimit.isPending} hitSlop={8} className="self-start">
            <Text className="font-ui-medium" style={{ fontSize: rf(14), color: colors.negative }}>Remove my limit</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}
