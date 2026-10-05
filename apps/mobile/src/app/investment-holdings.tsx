import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Stack } from "expo-router";
import { rollUpPositions, type Position } from "@tally/core/investments";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { SimplePickerSheet } from "@/components/ui/SimplePickerSheet";
import { PositionRow, Segmented } from "@/components/investments/parts";
import { HoldingSheet } from "@/components/investments/HoldingSheet";
import { useInvestments } from "@/lib/useInvestments";
import { usePlaidLink } from "@/lib/usePlaidLink";
import { formatPercent } from "@tally/core/money";
import { useRF } from "@/theme/responsiveFont";

type SortKey = "value" | "gainPct" | "gain" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "value", label: "Value" },
  { key: "gainPct", label: "Gain %" },
  { key: "gain", label: "Gain $" },
  { key: "name", label: "Name" },
];

function sortPositions(ps: Position[], key: SortKey): Position[] {
  const v = (p: Position) => (key === "gain" ? (p.gain?.amount ?? -Infinity) : key === "gainPct" ? (p.gain?.pct ?? -Infinity) : p.value);
  return [...ps].sort((a, b) => (key === "name" ? (a.ticker ?? a.securityName ?? "").localeCompare(b.ticker ?? b.securityName ?? "") : v(b) - v(a)));
}

/** Every holding, filterable by account and sortable -- "All N ›" from Investments. */
export default function InvestmentHoldingsScreen() {
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { linkingItemId } = usePlaidLink();
  const data = useInvestments(linkingItemId);
  const [account, setAccount] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("value");
  const [sortOpen, setSortOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const accounts = useMemo(() => [...new Map(data.holdings.map((h) => [h.accountId, h.accountName])).entries()], [data.holdings]);
  const scoped = account === "all" ? data.holdings : data.holdings.filter((h) => h.accountId === account);
  const positions = useMemo(() => sortPositions(rollUpPositions(scoped), sort), [scoped, sort]);
  const total = scoped.reduce((s, h) => s + h.institutionValue, 0);
  const open = data.positions.find((p) => p.securityId === openId) ?? null;

  const sortAction = (
    <Pressable onPress={() => setSortOpen(true)} hitSlop={10} className="px-2 py-1">
      <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(15) }}>Sort</Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <Stack.Screen options={{ headerRight: () => sortAction, unstable_headerRightItems: () => [{ type: "custom", element: sortAction, hidesSharedBackground: true }] }} />
      <ScreenGlow />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 40 }}>
        {accounts.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Segmented options={[{ key: "all", label: "All" }, ...accounts.map(([id, name]) => ({ key: id, label: name }))]} value={account} onChange={setAccount} />
          </ScrollView>
        )}
        <View className="flex-row justify-between px-1">
          <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
            {positions.length} holdings · by {SORTS.find((s) => s.key === sort)!.label.toLowerCase()}
          </Text>
          <MoneyText cents={total} className="font-ui text-text-2" style={{ fontSize: rf(12.5) }} />
        </View>
        <Card className="overflow-hidden">
          {positions.map((p, i) => {
            const note = data.staleNote(p);
            return (
              <PositionRow
                key={p.securityId}
                p={p}
                showTopBorder={i > 0}
                gainStyle="pct"
                onPress={() => setOpenId(p.securityId)}
                dim={!!note && !note.partial}
                caption={note ? note.text : `${formatPercent(p.weight)} of ${account === "all" ? "portfolio" : "account"}${p.originalCurrencies.some((c) => c !== "CAD") ? ` · ${p.originalCurrencies.join(", ")}, shown in CAD` : ""}`}
                captionTone={note?.partial ? "negative" : undefined}
              />
            );
          })}
        </Card>
      </ScrollView>

      <SimplePickerSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort holdings"
        items={SORTS.map((s) => ({ id: s.key, label: s.label }))}
        selectedId={sort}
        onSelect={(id) => {
          setSort(id as SortKey);
          setSortOpen(false);
        }}
      />
      <HoldingSheet
        position={open}
        holding={open ? (data.holdings.find((h) => h.securityId === open.securityId) ?? null) : null}
        activity={open ? data.activity.filter((t) => t.securityId === open.securityId) : []}
        onClose={() => setOpenId(null)}
      />
    </View>
  );
}
