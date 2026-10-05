import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl, KeyboardAvoidingView, Platform, Animated } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, RefreshCw } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { TabHeader, SyncFreshness, hasSynced } from "@/components/ui/TabHeader";
import { InstitutionActionsSheet, confirmRevokeItem } from "@/components/InstitutionActionsSheet";
import { InstitutionCard, AccountLine, toneColor } from "@/components/accounts/InstitutionCard";
import { AccountsSummary, AttentionStrip, SyncBanner } from "@/components/accounts/AccountsSummary";
import { AccountsSkeleton, ConnectFirstBank, AccountsLoadError } from "@/components/accounts/AccountsPlaceholders";
import { FixSheet } from "@/components/accounts/FixSheet";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useAccounts, type Institution } from "@/lib/queries/accounts";
import { usePlaidLink } from "@/lib/usePlaidLink";
import { useSync, useRefreshItemBalances, useRevokeItem, useItemRefreshStates } from "@/lib/queries/plaid";
import { connectionState, type ConnectionAction } from "@/lib/connectionState";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// MOBILE_DESIGN.md §5.5 -- grouped by institution, each card as loud as its
// connection's health (lib/connectionState.ts): summary first, an attention
// strip when any bank needs a tap, cards sorted most urgent first.

/** How long the "You're reconnected" confirmation stays before the card goes quiet. */
const RECONNECTED_MS = 6000;
const TOAST_MS = 4000;

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const colors = useThemeColors();
  const rf = useRF();
  const { data, isLoading, isError, refetch, isRefetching, dataUpdatedAt } = useAccounts();
  const { openLink, isLinking, linkingItemId, error: linkError } = usePlaidLink();
  const sync = useSync();
  const refreshBalances = useRefreshItemBalances();
  const revoke = useRevokeItem();
  const refreshStates = useItemRefreshStates();

  const [menuInstitutionId, setMenuInstitutionId] = useState<string | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  // Overview's "needs you" card links here with a fresh `fix` value each tap; open
  // the Fix sheet once per value, once there are banks to fix.
  const { fix } = useLocalSearchParams<{ fix?: string }>();
  const handledFix = useRef<string | undefined>(undefined);
  const [justReconnected, setJustReconnected] = useState<ReadonlySet<string>>(new Set());
  const [syncBanner, setSyncBanner] = useState<{ title: string; body?: string } | null>(null);
  const [dismissedLinkError, setDismissedLinkError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const institutions = useMemo(() => data?.institutions ?? [], [data]);
  const accountCount = institutions.reduce((n, i) => n + i.accounts.length, 0) + (data?.unlinkedAccounts.length ?? 0);
  const syncTimes = institutions.map((i) => i.lastSyncedAt);

  const cards = useMemo(() => {
    const withState = institutions.map((inst) => {
      const r = refreshStates.get(inst.id);
      return {
        institution: inst,
        state: connectionState(inst, {
          refreshing: (r?.refreshing ?? false) || sync.isPending,
          linking: linkingItemId === inst.id,
          justReconnected: justReconnected.has(inst.id),
          refreshFailed: r?.failed ?? false,
        }),
      };
    });
    return withState.sort(
      (a, b) => a.state.rank - b.state.rank || (a.institution.institutionName ?? "").localeCompare(b.institution.institutionName ?? ""),
    );
  }, [institutions, refreshStates, sync.isPending, linkingItemId, justReconnected]);

  const needsYou = cards.filter((c) => c.state.needsAttention);
  const blockedNames = needsYou.filter((c) => c.state.level === "blocked").map((c) => c.institution.institutionName ?? "a bank");
  useEffect(() => {
    if (fix && fix !== handledFix.current && needsYou.length > 0) {
      handledFix.current = fix;
      setFixOpen(true);
    }
  }, [fix, needsYou.length]);
  const menuCard = cards.find((c) => c.institution.id === menuInstitutionId) ?? null;

  async function reconnect(inst: Institution) {
    const ok = await openLink("update", inst.id);
    if (!ok) return;
    setJustReconnected((prev) => new Set(prev).add(inst.id));
    setTimeout(() => {
      setJustReconnected((prev) => {
        const next = new Set(prev);
        next.delete(inst.id);
        return next;
      });
    }, RECONNECTED_MS);
  }

  function runAction(inst: Institution, action: ConnectionAction) {
    if (action.kind === "signIn") reconnect(inst);
    else if (action.kind === "refresh") refreshBalances.mutate(inst.id);
    else confirmRevokeItem(inst.institutionName ?? "this institution", () => revoke.mutate(inst.id));
  }

  async function handleSyncAll() {
    setSyncBanner(null);
    try {
      const res = await sync.mutateAsync(["balances"]);
      const failed = res.results.filter((r) => r.failures.length > 0);
      const total = res.results.length;
      if (failed.length === 0) {
        setToast(total === 1 ? "Your bank is synced" : `All ${total} banks synced`);
      } else {
        // A failure stays on screen (MOBILE_DESIGN.md toast rule); the
        // failed banks' own cards say what to do about it.
        setSyncBanner({
          title: failed.length === 1 ? `${failed[0]!.institutionName ?? "A bank"} didn't sync` : `${failed.length} banks didn't sync`,
          body: `${total - failed.length} of ${total} synced. The cards below say what to do next.`,
        });
      }
    } catch {
      setSyncBanner({ title: "Sync failed", body: "Check your connection and try again." });
    }
  }

  const hasInstitutions = institutions.length > 0;
  const showLinkError = linkError && linkError !== dismissedLinkError;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenGlow />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 + tabBarClearance }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 pb-4">
            <TabHeader
              title="Accounts"
              meta={
                data && !hasInstitutions && data.unlinkedAccounts.length === 0
                  ? ["Nothing connected"]
                  : [
                      data && `${accountCount} account${accountCount === 1 ? "" : "s"}`,
                      hasInstitutions && `${institutions.length} bank${institutions.length === 1 ? "" : "s"}`,
                      data && hasSynced(syncTimes) && <SyncFreshness key="sync" syncedAt={syncTimes} />,
                    ]
              }
              actions={
                hasInstitutions && (
                  <>
                    <Pressable
                      onPress={handleSyncAll}
                      disabled={sync.isPending}
                      accessibilityLabel="Sync all banks"
                      className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 disabled:opacity-50 bg-brand-subtle"
                    >
                      {sync.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : <RefreshCw size={14} color={colors.brand} strokeWidth={2} />}
                      <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Sync</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openLink("create")}
                      disabled={isLinking}
                      className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 disabled:opacity-50 bg-brand-subtle"
                    >
                      {linkingItemId === "create" ? <ActivityIndicator size="small" color={colors.brand} /> : <Plus size={15} color={colors.brand} strokeWidth={2} />}
                      <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Add</Text>
                    </Pressable>
                  </>
                )
              }
            />
          </View>

          <View className="gap-4 px-5">
            {showLinkError && (
              <SyncBanner tone="negative" title="Couldn't connect to your bank" body={linkError} onDismiss={() => setDismissedLinkError(linkError)} />
            )}
            {syncBanner && <SyncBanner tone="warning" title={syncBanner.title} body={syncBanner.body} onDismiss={() => setSyncBanner(null)} />}
            {isError && data && (
              <SyncBanner
                tone="warning"
                title="Couldn't refresh"
                body={`Showing saved data from ${new Date(dataUpdatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Pull down to try again.`}
              />
            )}

            {isLoading ? (
              <AccountsSkeleton />
            ) : !data ? (
              isError && <AccountsLoadError onRetry={() => refetch()} retrying={isRefetching} />
            ) : !hasInstitutions && data.unlinkedAccounts.length === 0 ? (
              <ConnectFirstBank onConnect={() => openLink("create")} connecting={isLinking} />
            ) : (
              <>
                <AccountsSummary net={data.totals.net} assets={data.totals.assets} liabilities={data.totals.liabilities} />
                {needsYou.length > 0 && <AttentionStrip count={needsYou.length} blockedNames={blockedNames} onPress={() => setFixOpen(true)} />}
                <View className="gap-5">
                  {cards.map(({ institution, state }) => (
                    <InstitutionCard
                      key={institution.id}
                      institution={institution}
                      state={state}
                      onAction={(action) => runAction(institution, action)}
                      onOpenMenu={() => setMenuInstitutionId(institution.id)}
                      baseCurrency={data.totals.currency}
                    />
                  ))}
                </View>
                {data.unlinkedAccounts.length > 0 && (
                  <View className="gap-2 mt-1">
                    <Text className="font-ui-semibold text-text-3 px-1" style={{ fontSize: rf(11.5), letterSpacing: 0.6, textTransform: "uppercase" }}>
                      Other accounts
                    </Text>
                    {/* Accounts with no bank connection behind them -- already
                        counted in the totals above, so they're listed here
                        rather than left as an unexplained difference. */}
                    <Card className="overflow-hidden">
                      {data.unlinkedAccounts.map((a, i) => (
                        <AccountLine key={a.id} account={a} showTopBorder={i > 0} baseCurrency={data.totals.currency} caption="Not linked to a bank" />
                      ))}
                      <View className="px-5 py-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
                        <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>Still counted in your net worth</Text>
                      </View>
                    </Card>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast message={toast} onHidden={hideToast} bottom={tabBarClearance + 16} />

      <FixSheet
        visible={fixOpen}
        onClose={() => setFixOpen(false)}
        items={needsYou}
        // Let the sheet's close animation finish first: Plaid Link presents
        // its own native modal, which iOS won't stack on a closing one.
        onAction={(inst, action) => setTimeout(() => runAction(inst, action), 350)}
      />

      {menuCard && (
        <InstitutionActionsSheet
          visible={menuInstitutionId !== null}
          onClose={() => setMenuInstitutionId(null)}
          itemId={menuCard.institution.id}
          institutionName={menuCard.institution.institutionName ?? "this institution"}
          onManageAccess={() => reconnect(menuCard.institution)}
          status={{
            label: menuCard.state.notice?.title ?? (menuCard.state.level === "quiet" ? "Up to date" : menuCard.state.statusLine),
            color: menuCard.state.level === "quiet" ? colors.text! : toneColor(colors, menuCard.state.tone),
          }}
          lastSyncedAt={menuCard.institution.lastSyncedAt}
          accountCount={menuCard.institution.accounts.length}
        />
      )}
    </View>
  );
}

/** Bottom-center, above the tab bar, 4s (MOBILE_DESIGN.md's toast row). */
function Toast({ message, onHidden, bottom }: { message: string | null; onHidden: () => void; bottom: number }) {
  const rf = useRF();
  const colors = useThemeColors();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onHidden());
    }, TOAST_MS);
    return () => clearTimeout(t);
  }, [message, opacity, onHidden]);

  if (!message) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom, alignItems: "center", opacity }}>
      <View className="flex-row items-center gap-2 rounded-full bg-raised px-4 py-2.5" style={{ borderWidth: 1, borderColor: colors.border }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.positive }} />
        <Text className="font-ui-medium text-text" style={{ fontSize: rf(13) }}>{message}</Text>
      </View>
    </Animated.View>
  );
}
