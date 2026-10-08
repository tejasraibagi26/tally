import { useEffect, useState } from "react";
import { View, Text, Pressable, AccessibilityInfo } from "react-native";
import { AlertTriangle, Check, CheckCircle2, Clock, X, XCircle } from "lucide-react-native";
import { SYNC_SLOW_AFTER_MS, syncDialogCopy, syncSteps, type SyncDialogMode, type SyncDialogPhase } from "@tally/core/syncDialog";
import { Sheet } from "@/components/ui/Sheet";
import { TallyLoader } from "@/components/ui/TallyLoader";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

export interface ProgressState {
  mode: SyncDialogMode;
  /** "slow" is derived here from startedAt, not stored. */
  phase: Exclude<SyncDialogPhase, "slow">;
  institutionName: string | null;
  /** Plaid account types picked in Link -- drives which step rows show. */
  accountTypes: string[];
  /** null while running. */
  failures: { product: string; label: string }[] | null;
  errorCode: string | null;
  errorStage: "link" | "save";
  startedAt: number;
}

function elapsedLabel(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Mobile's counterpart of web's SyncDialog (MOBILE_DESIGN.md §6): the
 * stretch after Plaid Link's own modal closes -- which bank, what's being
 * pulled, how long to expect, how it ended. Locked (no grabber, no swipe)
 * while running; the tally mark writing itself is the only indicator.
 */
export function ProgressSheet({ state, onClose, onRetry }: { state: ProgressState | null; onClose: () => void; onRetry: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const [now, setNow] = useState(() => Date.now());
  // Keep the last state through the sheet's close animation.
  const [shown, setShown] = useState(state);
  useEffect(() => {
    if (state) setShown(state);
  }, [state]);

  const running = state?.phase === "syncing";
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const s = state ?? shown;
  const elapsed = s ? now - s.startedAt : 0;
  const phase: SyncDialogPhase | null = s ? (s.phase === "syncing" && elapsed >= SYNC_SLOW_AFTER_MS ? "slow" : s.phase) : null;
  const copy =
    s && phase
      ? syncDialogCopy({
          mode: s.mode,
          phase,
          institutionName: s.institutionName,
          accountCount: s.accountTypes.length,
          failureLabels: (s.failures ?? []).map((f) => f.label),
          errorCode: s.errorCode,
          errorStage: s.errorStage,
        })
      : null;

  // Screen readers hear each phase change through its title.
  useEffect(() => {
    if (state && copy) AccessibilityInfo.announceForAccessibility(copy.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, phase === "slow"]);

  if (!s || !phase || !copy) return null;
  const isRunning = phase === "syncing" || phase === "slow";
  const steps = s.phase === "failed" ? [] : syncSteps(s.accountTypes, s.failures);

  const tone = phase === "syncing" ? "brand" : phase === "success" ? "positive" : phase === "failed" ? "negative" : "warning";
  const toneColor = colors[tone]!;
  const toneBg = colors[`${tone}-subtle`]!;

  return (
    <Sheet visible={state !== null} onClose={onClose} dismissible={!isRunning} maxHeight="85%">
      <View className="px-5 pt-1 gap-4" style={{ paddingBottom: 24 }}>
        <View className="flex-row items-start gap-3.5">
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: toneBg, alignItems: "center", justifyContent: "center" }}>
            {isRunning ? (
              <TallyLoader color={toneColor} slow={phase === "slow"} />
            ) : phase === "success" ? (
              <CheckCircle2 size={20} color={toneColor} strokeWidth={1.75} />
            ) : phase === "partial" ? (
              <AlertTriangle size={20} color={toneColor} strokeWidth={1.75} />
            ) : (
              <XCircle size={20} color={toneColor} strokeWidth={1.75} />
            )}
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }} accessibilityRole="header">
              {copy.title}
            </Text>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>
              {phase === "slow" ? `${copy.subtitle} · ${elapsedLabel(elapsed)}` : copy.subtitle}
            </Text>
          </View>
        </View>

        {steps.length > 0 && (
          <View className="rounded-[10px] bg-surface-2 overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border }}>
            {steps.map((row, i) => {
              const c = row.status === "done" ? colors.positive! : row.status === "failed" ? colors.negative! : colors["text-3"]!;
              return (
                <View
                  key={row.key}
                  className="flex-row items-center gap-2.5 px-3 py-2.5"
                  style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
                >
                  <View style={{ width: 16, alignItems: "center" }}>
                    {row.status === "pending" ? (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                    ) : row.status === "done" ? (
                      <Check size={16} color={c} strokeWidth={2} />
                    ) : (
                      <X size={16} color={c} strokeWidth={2} />
                    )}
                  </View>
                  <Text className="font-ui text-text flex-1" style={{ fontSize: rf(13.5) }}>{row.label}</Text>
                  <Text className="font-ui" style={{ fontSize: rf(12.5), color: c, fontVariant: ["tabular-nums"] }}>
                    {row.status === "failed" ? "Didn't come through" : row.detail ?? (row.status === "done" ? "Done" : "")}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {phase === "slow" && copy.body && (
          <View className="flex-row items-start gap-2.5 rounded-[10px] bg-surface-2 px-3 py-2.5" style={{ borderWidth: 1, borderColor: colors.border }}>
            <Clock size={16} color={colors["text-3"]} strokeWidth={1.75} style={{ marginTop: 1 }} />
            <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(13), lineHeight: rf(18) }}>{copy.body}</Text>
          </View>
        )}
        {(phase === "partial" || phase === "failed") && copy.body && (
          <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>{copy.body}</Text>
        )}

        {phase === "partial" && <Pill label="Done" onPress={onClose} variant="primary" />}
        {phase === "failed" && (
          <View className="gap-2">
            <Pill
              label={s.mode === "update" && s.errorStage === "save" ? "Try sync again" : s.mode === "create" ? "Connect again" : "Sign in again"}
              onPress={onRetry}
              variant="primary"
            />
            <Pill label="Close" onPress={onClose} variant="secondary" />
          </View>
        )}
      </View>
    </Sheet>
  );
}

function Pill({ label, onPress, variant }: { label: string; onPress: () => void; variant: "primary" | "secondary" }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={variant === "primary" ? "rounded-full bg-brand items-center justify-center active:opacity-90" : "rounded-full bg-surface-2 items-center justify-center active:opacity-80"}
      style={[{ height: 50 }, variant === "secondary" ? { borderWidth: 1, borderColor: colors.border } : null]}
    >
      <Text className={variant === "primary" ? "font-ui-semibold text-on-brand" : "font-ui-semibold text-text"} style={{ fontSize: rf(15) }}>
        {label}
      </Text>
    </Pressable>
  );
}
