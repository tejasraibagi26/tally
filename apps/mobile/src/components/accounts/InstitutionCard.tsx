import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Pressable } from "react-native";
import { MoreHorizontal, X, ChevronDown, ChevronUp } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { useUpdateAccountNickname, type Institution, type AccountRow } from "@/lib/queries/accounts";
import { ago, type ConnectionAction, type ConnectionState, type ConnectionTone } from "@/lib/connectionState";
import { hairline, withAlpha } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { BusyIcon, BusyLabel } from "@/components/ui/BusyIcon";

type Colors = ReturnType<typeof useThemeColors>;

/** Healthy cards with more accounts than this show the first few plus "+N more". */
const PREVIEW_ROWS = 3;

export function toneColor(colors: Colors, tone: ConnectionTone): string {
  return tone === "neutral" ? colors["text-3"]! : colors[tone]!;
}

export function toneSubtle(colors: Colors, tone: ConnectionTone): string {
  return tone === "neutral" ? colors.sunken! : colors[`${tone}-subtle`]!;
}

/**
 * A state's action button, always drawn in that state's own color, so an
 * amber "Sync now" reads as the same severity as the amber notice it sits in.
 * Remove is the one neutral exception: it's an alternative, not the fix.
 */
export function StateButton({
  action,
  tone,
  pending,
  onPress,
  grow,
  compact,
}: {
  action: ConnectionAction;
  tone: ConnectionTone;
  pending?: boolean;
  onPress: () => void;
  grow?: boolean;
  /** 32 high instead of 36, for tight rows like Overview's Needs you card. */
  compact?: boolean;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const neutral = action.kind === "remove";
  const bg = neutral ? colors.raised : toneColor(colors, tone);
  const fg = neutral ? colors.text : colors["on-brand"];
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      className={`${compact ? "h-8 px-3.5" : "h-9 px-4"} rounded-full items-center justify-center active:opacity-80`}
      style={{ backgroundColor: bg, minWidth: 64, flexGrow: grow ? 1 : 0, flexShrink: 0, opacity: pending ? 0.75 : 1 }}
    >
      <BusyLabel busy={!!pending} color={fg!}>
        <Text className="font-ui-semibold" style={{ color: fg, fontSize: rf(13) }}>{action.label}</Text>
      </BusyLabel>
    </Pressable>
  );
}

function StatusDot({ tone, busy }: { tone: ConnectionTone; busy: boolean }) {
  const colors = useThemeColors();
  if (busy) return <ActivityIndicator size="small" color={colors["text-3"]} style={{ transform: [{ scale: 0.6 }], width: 10, height: 10 }} />;
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColor(colors, tone) }} />;
}

/**
 * One connection: header (avatar, full name, status line), at most one
 * notice with its action, then the account rows and total. How loud the
 * card is comes entirely from `state` (lib/connectionState.ts).
 */
export function InstitutionCard({
  institution,
  state,
  onAction,
  onOpenMenu,
  baseCurrency,
}: {
  institution: Institution;
  state: ConnectionState;
  onAction: (action: ConnectionAction) => void;
  onOpenMenu: () => void;
  baseCurrency?: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  // false = the state's default (blocked cards collapsed, others previewed).
  const [expanded, setExpanded] = useState(false);
  const name = institution.institutionName ?? "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const accent = toneColor(colors, state.tone);
  const loud = state.level === "act" || state.level === "blocked";
  const statusColor = state.level === "quiet" || state.busy ? colors["text-3"] : accent;

  const accounts = institution.accounts;
  const isCollapsed = !expanded && state.collapsed;
  const visibleRows = isCollapsed ? [] : expanded ? accounts : accounts.slice(0, PREVIEW_ROWS);
  const canShrink = expanded && (state.collapsed || accounts.length > PREVIEW_ROWS);
  const hiddenCount = accounts.length - visibleRows.length;
  const mixedCurrency = !!baseCurrency && accounts.some((a) => a.currency !== baseCurrency);

  return (
    <Card className="overflow-hidden" style={loud ? { borderWidth: 1, borderColor: withAlpha(accent, 0.35) } : undefined}>
      <View className="flex-row items-center justify-between px-5 pt-[18px] pb-3.5">
        <View className="flex-row items-center gap-3 flex-1 pr-3">
          <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: loud ? toneSubtle(colors, state.tone) : colors["brand-subtle"] }}>
            <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: loud ? accent : colors.brand }}>{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>{name}</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <StatusDot tone={state.tone} busy={state.busy} />
              <Text className="font-ui" style={{ fontSize: rf(12), color: statusColor }} numberOfLines={1}>{state.statusLine}</Text>
            </View>
          </View>
        </View>
        {/* Opens InstitutionActionsSheet (Sync now / Manage access / Revoke).
            "⋯" is the established "more actions" affordance and matches
            components/plaid/ItemActionsMenu.tsx's web equivalent. */}
        <Pressable onPress={onOpenMenu} hitSlop={8} accessibilityLabel="Connection actions" className="w-7 h-7 rounded-full items-center justify-center bg-sunken">
          <MoreHorizontal size={16} color={colors["text-2"]} strokeWidth={2} />
        </Pressable>
      </View>

      {state.notice && (
        <Notice
          tone={state.tone}
          title={state.notice.title}
          body={state.notice.body}
          // Two choices (revoked) go on their own row beneath; one fits inline.
          inlineAction={!state.secondaryAction ? state.action : undefined}
          pending={state.actionPending}
          onAction={onAction}
        />
      )}
      {state.notice && state.action && state.secondaryAction && (
        <View className="flex-row gap-2 px-4 pb-2">
          <StateButton action={state.action} tone={state.tone} pending={state.actionPending} onPress={() => onAction(state.action!)} grow />
          <StateButton action={state.secondaryAction} tone={state.tone} onPress={() => onAction(state.secondaryAction!)} />
        </View>
      )}

      <View style={state.notice ? { marginTop: 6 } : undefined}>
        {visibleRows.map((a, i) => (
          <AccountLine key={a.id} account={a} showTopBorder={i > 0} dim={state.dimBalances} baseCurrency={baseCurrency} />
        ))}
      </View>

      {hiddenCount > 0 && !isCollapsed && (
        <Pressable onPress={() => setExpanded(true)} className="flex-row items-center gap-1 px-5 py-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
          <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>+{hiddenCount} more account{hiddenCount === 1 ? "" : "s"}</Text>
          <ChevronDown size={14} color={colors["text-2"]} strokeWidth={2} />
        </Pressable>
      )}

      {accounts.length > 0 && (
        <Pressable
          onPress={() => setExpanded(isCollapsed)}
          disabled={!isCollapsed && !canShrink}
          className="flex-row items-center justify-between px-5 py-3.5"
          style={visibleRows.length > 0 || hiddenCount > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
        >
          <View className="flex-row items-center gap-1 flex-1 pr-3">
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }} numberOfLines={1}>
              {isCollapsed
                ? `${accounts.length} account${accounts.length === 1 ? "" : "s"}${state.dimBalances ? ` · as of ${ago(institution.lastSyncedAt)}` : ""}`
                : state.dimBalances
                  ? `Total as of ${ago(institution.lastSyncedAt)}`
                  : "Total"}
            </Text>
            {isCollapsed && <ChevronDown size={14} color={colors["text-3"]} strokeWidth={2} />}
            {canShrink && <ChevronUp size={14} color={colors["text-3"]} strokeWidth={2} />}
          </View>
          <View className="flex-row items-baseline gap-1.5" style={{ flexShrink: 0 }}>
            <MoneyText cents={institution.total} className={`font-ui-semibold ${state.dimBalances ? "text-text-3" : "text-text"}`} style={{ fontSize: rf(15) }} />
            {/* The rows are each labeled in their own currency, so a
                mixed-currency connection's total would otherwise look like it
                disagrees with them -- name the currency it was converted into. */}
            {mixedCurrency && <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11) }}>{baseCurrency}</Text>}
          </View>
        </Pressable>
      )}
    </Card>
  );
}

function Notice({
  tone,
  title,
  body,
  inlineAction,
  pending,
  onAction,
}: {
  tone: ConnectionTone;
  title: string;
  body: string;
  inlineAction?: ConnectionAction;
  pending: boolean;
  onAction: (action: ConnectionAction) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const accent = toneColor(colors, tone);
  return (
    <View
      className="mx-4 mb-2 rounded-[14px] flex-row items-center gap-3 pl-3.5 pr-3 py-3"
      style={{ backgroundColor: toneSubtle(colors, tone), borderWidth: 1, borderColor: withAlpha(accent, 0.25) }}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-semibold" style={{ color: accent, fontSize: rf(13.5) }}>{title}</Text>
        <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5), lineHeight: rf(17) }}>{body}</Text>
      </View>
      {inlineAction && <StateButton action={inlineAction} tone={tone} pending={pending} onPress={() => onAction(inlineAction)} />}
    </View>
  );
}

// Registered-account and plan names Plaid sends in lowercase ("tfsa").
const ACRONYMS = new Set(["tfsa", "rrsp", "fhsa", "resp", "rrif", "lira", "lif", "hsa", "ira", "401k", "403b", "529", "cd", "gic"]);

/** "Credit card", "Savings", "TFSA" -- from Plaid's subtype, falling back to its type. */
function accountKind(a: AccountRow): string {
  const raw = (a.subtype ?? a.type).replace(/_/g, " ").trim();
  if (ACRONYMS.has(raw.toLowerCase())) return raw.toUpperCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Balances are stored positive for every type -- for a card or loan that's what's owed. */
function isDebt(a: AccountRow): boolean {
  return a.type === "credit" || a.type === "loan";
}

export function AccountLine({
  account,
  showTopBorder,
  dim,
  baseCurrency,
  caption,
}: {
  account: AccountRow;
  showTopBorder: boolean;
  dim?: boolean;
  baseCurrency?: string;
  /** Replaces the "type · ····mask" line (Other accounts). */
  caption?: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(account.nickname ?? "");
  const updateNickname = useUpdateAccountNickname(account.id);
  const border = showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined;

  function save() {
    updateNickname.mutate(input.trim() || null, { onSuccess: () => setEditing(false) });
  }

  const showWas = input.trim() !== "" && input.trim() !== account.name;

  if (editing) {
    return (
      <View className="flex-row items-center gap-2 px-4 py-2.5" style={border}>
        <View className="flex-1 justify-center">
        <TextInput
          autoFocus
          value={input}
          onChangeText={setInput}
          onSubmitEditing={save}
          returnKeyType="done"
          placeholder={account.realName}
          placeholderTextColor={colors["text-3"]}
          maxLength={60}
          // h-12 matches every other text input in the app; the explicit
          // style guards against Inter's ascenders clipping in a shorter box.
          className="h-12 rounded-control bg-surface-2 px-3 font-ui text-text"
          style={{ paddingVertical: 0, paddingRight: showWas ? 96 : 12, textAlignVertical: "center", fontSize: rf(14), borderWidth: 1, borderColor: colors.brand }}
        />
        {/* The name it had before this edit, so a rename is never a guess
            about what you're replacing. Clearing the field restores the
            bank's own name (shown as the placeholder). */}
        {showWas && (
          <Text pointerEvents="none" className="font-ui text-text-3 absolute right-3" style={{ fontSize: rf(11), maxWidth: 88 }} numberOfLines={1}>
            was “{account.name}”
          </Text>
        )}
        </View>
        <Pressable onPress={save} disabled={updateNickname.isPending} className="h-9 rounded-full items-center justify-center px-4 bg-brand active:opacity-80">
          <BusyLabel busy={updateNickname.isPending} color={colors["on-brand"]!}>
            <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(13) }}>Save</Text>
          </BusyLabel>
        </Pressable>
        <Pressable
          onPress={() => {
            setEditing(false);
            setInput(account.nickname ?? "");
          }}
          disabled={updateNickname.isPending}
          hitSlop={10}
          accessibilityLabel="Cancel rename"
        >
          <X size={18} color={colors["text-3"]} strokeWidth={2.25} />
        </Pressable>
      </View>
    );
  }

  const foreign = !!baseCurrency && account.currency !== baseCurrency;
  return (
    <View className="flex-row items-center justify-between px-5 py-3" style={border}>
      {/* No resting pencil: it crowded long names. Tap or long-press the
          name to rename; accessibilityHint says so for screen readers. */}
      <Pressable
        onPress={() => setEditing(true)}
        onLongPress={() => setEditing(true)}
        accessibilityLabel={account.name}
        accessibilityHint="Renames this account"
        className="flex-1 pr-3 gap-0.5"
      >
        <Text className={`font-ui-medium ${dim ? "text-text-2" : "text-text"}`} style={{ fontSize: rf(14.5) }} numberOfLines={1}>{account.name}</Text>
        <Text className="text-text-3" style={{ fontFamily: "JetBrainsMono", fontSize: rf(11.5) }} numberOfLines={1}>
          {caption ?? `${accountKind(account)}${account.mask ? ` · ····${account.mask}` : ""}`}
        </Text>
      </Pressable>
      <View style={{ flexShrink: 0, alignItems: "flex-end" }}>
        {account.currentBalance == null ? (
          // A missing balance is unknown, not zero -- "$0.00" read as a real
          // (and alarming) figure.
          <>
            <Text className="font-ui text-text-3" style={{ fontSize: rf(15) }}>—</Text>
            <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11) }}>No balance from bank</Text>
          </>
        ) : (
          // Debts get a minus sign (not red) so a card's balance can't be
          // misread as money held; the rows then agree with the total below.
          <MoneyText cents={isDebt(account) ? -account.currentBalance : account.currentBalance} className={dim ? "text-text-3" : "text-text"} style={{ fontSize: rf(15) }} />
        )}
        {foreign && account.currentBalance != null && <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11) }}>{account.currency}</Text>}
      </View>
    </View>
  );
}
