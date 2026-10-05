import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Minus, Plus, CircleDollarSign, Circle, type LucideIcon } from "lucide-react-native";
import { formatCents, formatPercent } from "@tally/core/money";
import { describeInvestmentTxn, type Position, type TxnIcon } from "@tally/core/investments";
import { MoneyText } from "@/components/ui/MoneyText";
import type { InvestmentTransactionRow } from "@/lib/queries/investments";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

export function formatQuantity(q: number): string {
  return Number.isInteger(q) ? q.toLocaleString() : q.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Ticker({ ticker, isCash, size = 34 }: { ticker: string | null; isCash: boolean; size?: number }) {
  const rf = useRF();
  return (
    <View className="rounded-[9px] bg-surface-2 items-center justify-center" style={{ width: size, height: size }}>
      <Text className="text-text-2" style={{ fontFamily: "JetBrainsMono_Medium", fontSize: rf(9.5), letterSpacing: -0.3 }} numberOfLines={1}>
        {isCash ? "CASH" : (ticker ?? "?").slice(0, 5)}
      </Text>
    </View>
  );
}

/**
 * One position (rolled up across accounts). Individual holdings stay
 * unmasked in privacy mode, per MoneyText's documented scope -- only
 * portfolio totals hide.
 */
export function PositionRow({
  p,
  caption,
  captionTone,
  dim,
  showTopBorder,
  onPress,
  gainStyle = "both",
}: {
  p: Position;
  caption: string;
  captionTone?: "negative";
  dim?: boolean;
  showTopBorder: boolean;
  onPress: () => void;
  gainStyle?: "both" | "pct";
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const gainColor = p.gain ? (p.gain.amount < 0 ? colors.negative : colors.positive) : colors["text-3"];
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-2" style={showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
      <Ticker ticker={p.ticker} isCash={p.isCashEquivalent} />
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>
          {p.securityName ?? p.ticker ?? "Unknown security"}
        </Text>
        <Text className="font-ui" style={{ fontSize: rf(11.5), color: captionTone === "negative" ? colors.negative : colors["text-3"] }} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <MoneyText cents={p.value} mask={false} className={`font-ui-semibold ${dim ? "text-text-3" : "text-text"}`} style={{ fontSize: rf(14) }} />
        <Text className="font-ui" style={{ fontSize: rf(11.5), color: gainColor, fontVariant: ["tabular-nums"] }}>
          {p.gain
            ? gainStyle === "pct"
              ? `${p.gain.amount < 0 ? "−" : "+"}${formatPercent(Math.abs(p.gain.pct))}`
              : `${formatCents(p.gain.amount, { signed: true })} · ${formatPercent(Math.abs(p.gain.pct))}`
            : p.isCashEquivalent
              ? "—"
              : "No cost basis"}
        </Text>
      </View>
    </Pressable>
  );
}

const ICONS: Record<TxnIcon, LucideIcon> = {
  buy: ArrowDownLeft,
  sell: ArrowUpRight,
  income: CircleDollarSign,
  deposit: Plus,
  withdrawal: Minus,
  transfer: ArrowLeftRight,
  fee: Minus,
  other: Circle,
};

/** One activity row in plain words (@tally/core/investments' describeInvestmentTxn). */
export function ActivityItem({ tx, showTopBorder, showAccount = true }: { tx: InvestmentTransactionRow; showTopBorder: boolean; showAccount?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  const d = describeInvestmentTxn(tx, (c) => formatCents(c));
  const Icon = ICONS[d.icon];
  const tone = d.tone === "positive" ? colors.positive : d.tone === "negative" ? colors.negative : colors.text;
  const bg = d.tone === "positive" ? colors["positive-subtle"] : d.tone === "negative" ? colors["negative-subtle"] : colors["surface-2"];
  const meta = [shortDate(tx.date), showAccount && tx.accountName, d.detail].filter(Boolean).join(" · ");
  return (
    <View className="flex-row items-center gap-3 px-4 py-3" style={showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
      <View className="w-[30px] h-[30px] rounded-[9px] items-center justify-center" style={{ backgroundColor: bg }}>
        <Icon size={15} color={d.tone === "neutral" ? colors["text-2"] : tone} strokeWidth={1.9} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{d.title}</Text>
        <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }} numberOfLines={1}>{meta}</Text>
      </View>
      <Text className="font-ui-semibold" style={{ color: tone, fontSize: rf(14), fontVariant: ["tabular-nums"] }}>
        {formatCents(d.amount, { signed: d.signed })}
      </Text>
    </View>
  );
}

/** Two-to-five option segmented control (range, allocation view, account filter). */
export function Segmented<T extends string>({ options, value, onChange, disabled }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: (v: T) => boolean }) {
  const rf = useRF();
  return (
    <View className="flex-row self-start rounded-full bg-sunken p-[3px]" style={{ gap: 2 }}>
      {options.map((o) => {
        const off = disabled?.(o.key) ?? false;
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => !off && onChange(o.key)} disabled={off} accessibilityRole="tab" accessibilityState={{ selected: on, disabled: off }} className={`px-2.5 py-1 rounded-full ${on ? "bg-raised" : ""}`} style={{ opacity: off ? 0.4 : 1 }}>
            <Text className={`font-ui-medium ${on ? "text-text" : "text-text-3"}`} style={{ fontSize: rf(12) }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
