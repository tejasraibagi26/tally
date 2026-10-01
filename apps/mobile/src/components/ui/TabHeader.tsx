import { Fragment, type ReactNode } from "react";
import { View, Text } from "react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * The header every tab screen (Overview, Transactions, Budgets, Accounts)
 * opens with -- mobile's counterpart of web's PageHeader
 * (apps/web/components/ui/PageHeader.tsx). Default: the title with a muted
 * context line under it (period, counts, sync freshness) and the screen's
 * actions on the right. Passing `eyebrow` + `figure` switches to the
 * headline variant (section label, title, then the one number the screen is
 * about), used by Transactions.
 */
export function TabHeader({
  title,
  meta,
  actions,
  eyebrow,
  figure,
  figureContext,
}: {
  title: string;
  /** Short context items, joined with dots. Falsy entries are skipped. */
  meta?: ReactNode[];
  actions?: ReactNode;
  eyebrow?: string;
  figure?: ReactNode;
  figureContext?: ReactNode;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const metaItems = (meta ?? []).filter(Boolean);

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5 min-w-0">
          {eyebrow && (
            <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>
              {eyebrow}
            </Text>
          )}
          <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(24) }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {actions && <View className="flex-row items-center gap-2">{actions}</View>}
      </View>

      {figure != null && (
        <View className="gap-0.5 pt-1">
          {figure}
          {figureContext && (
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>
              {figureContext}
            </Text>
          )}
        </View>
      )}

      {metaItems.length > 0 && (
        <View className="flex-row flex-wrap items-center" style={{ columnGap: 7, rowGap: 2 }}>
          {metaItems.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors["border-strong"] }} />}
              {typeof item === "string" ? (
                <Text className="font-ui text-text-3" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>
                  {item}
                </Text>
              ) : (
                item
              )}
            </Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

function agoLabel(date: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * "Synced 4 min ago" for a TabHeader meta line. Uses the least-recent sync
 * across connections (so it never reads fresher than the stalest data), with
 * a dot colored by the WORK.md §8.3 freshness contract: < 6h, 6–48h, older.
 * Same rules as web's SyncFreshness. Renders nothing before any sync.
 */
export function SyncFreshness({ syncedAt }: { syncedAt: (string | null | undefined)[] }) {
  const colors = useThemeColors();
  const rf = useRF();
  const times = syncedAt.filter((s): s is string => Boolean(s)).map((s) => new Date(s).getTime());
  if (times.length === 0) return null;
  const oldest = new Date(Math.min(...times));
  const hours = (Date.now() - oldest.getTime()) / 3_600_000;
  const dot = hours < 6 ? colors.positive : hours <= 48 ? colors.warning : colors.negative;
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
      <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>
        Synced {agoLabel(oldest)}
      </Text>
    </View>
  );
}

/** True when any connection has synced, i.e. SyncFreshness will render. */
export function hasSynced(syncedAt: (string | null | undefined)[]): boolean {
  return syncedAt.some(Boolean);
}
