import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useLoans, type LoanSummary } from "@/lib/queries/loans";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";

const SUBTYPE_LABEL: Record<string, string> = {
  mortgage: "Mortgage",
  student: "Student loan",
  auto: "Car loan",
  personal: "Personal loan",
  "line of credit": "Line of credit",
  "home equity": "Home equity",
};

function kindLabel(l: LoanSummary): string {
  const key = l.subtype ?? l.detail?.kind ?? "";
  return SUBTYPE_LABEL[key] ?? (key ? key[0]!.toUpperCase() + key.slice(1) : "Loan");
}

const dateLabel = (iso: string, withYear = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });

/**
 * Loans (mobile v2.13.0, web's /loans): every debt that isn't a credit card,
 * from GET /api/loans. Balances already count against net worth; mortgages
 * and student loans add the lender's rate and next payment, which Forecast
 * and Safe to spend also take out of cash. Reached from the More sheet.
 */
export default function LoansScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { hidden } = usePrivacy();
  const { data, isLoading, refetch, isRefetching } = useLoans();
  const money = (c: number, currency: string) => (hidden ? "••••" : formatCents(c) + (currency !== "CAD" ? ` ${currency}` : ""));
  const loans = data?.loans ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color={colors["text-3"]} />
      </View>
    );
  }

  const totals = new Map<string, number>();
  for (const l of loans) totals.set(l.currency, (totals.get(l.currency) ?? 0) + l.balance);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {loans.length === 0 ? (
          <Card className="p-5 gap-2">
            <Text className="font-display text-text" style={{ fontSize: rf(17) }}>No loans connected</Text>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
              Mortgages, student loans, car and personal loans and lines of credit show up here once their bank is connected, and their balances count against your net worth.
            </Text>
          </Card>
        ) : (
          <>
            <Card className="p-5 gap-1">
              <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(11.5), letterSpacing: 0.8, textTransform: "uppercase" }}>You owe</Text>
              {[...totals].map(([currency, cents]) => (
                <Text key={currency} className="font-display text-text" style={{ fontSize: rf(32), fontVariant: ["tabular-nums"] }}>
                  {money(cents, currency)}
                </Text>
              ))}
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>Counted against your net worth</Text>
            </Card>

            <Card className="px-5">
              {loans.map((l, i) => {
                const d = l.detail;
                return (
                  <View key={l.accountId} className="py-4 gap-2" style={i < loans.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>{l.label}</Text>
                        <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }} numberOfLines={1}>
                          {kindLabel(l)}
                          {l.institutionName ? ` · ${l.institutionName}` : ""}
                        </Text>
                      </View>
                      <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15), fontVariant: ["tabular-nums"] }}>{money(l.balance, l.currency)}</Text>
                    </View>
                    {d ? (
                      <View className="flex-row flex-wrap" style={{ columnGap: 14, rowGap: 2 }}>
                        {d.nextPaymentAmount != null && (
                          <View className="flex-row items-center gap-1">
                            {d.isOverdue && <AlertTriangle size={12} color={colors.negative} strokeWidth={2.5} />}
                            <Text className="font-ui" style={{ fontSize: rf(12.5), color: d.isOverdue ? colors.negative : colors["text-2"] }}>
                              {money(d.nextPaymentAmount, l.currency)} {d.isOverdue ? "past due" : d.nextPaymentDueDate ? `due ${dateLabel(d.nextPaymentDueDate)}` : "next"}
                            </Text>
                          </View>
                        )}
                        {d.interestRate != null && <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>{Number(d.interestRate).toFixed(2)}%</Text>}
                        {d.payoffDate && <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>paid off {dateLabel(d.payoffDate, true)}</Text>}
                      </View>
                    ) : (
                      <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>The bank only shares this loan&apos;s balance.</Text>
                    )}
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
