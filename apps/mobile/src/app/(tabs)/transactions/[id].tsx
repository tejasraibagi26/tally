import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Switch, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { X, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCents } from "@tally/core/money";
import { prettifyPfc } from "@tally/core/pfc";
import { describeTransactionDetail, splitBalance, splitEvenly, spreadMonthly } from "@tally/core/transactionView";
import {
  useTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useMarkAnnual,
  useUpdateSpread,
  useMerchantRulePreview,
  type TransactionPatch,
  type TransactionRow,
} from "@/lib/queries/transactions";
import { useCategories, type Category } from "@/lib/queries/categories";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { withAlpha, hairline, chartSeries } from "@/theme/colors";

const TERMS = [3, 6, 9, 12] as const;
const NOTE_DEBOUNCE_MS = 600;

type Status = "idle" | "saving" | "saved" | "error";

// MOBILE_DESIGN.md §5.4 -- the transaction edit sheet, same blocks and order
// as web's TransactionDetailPanel: category first (who set it, suggestions,
// the merchant rule), how it counts (excluded, split, spread), note and
// tags, then folded-away details. Every change saves on its own with an
// Undo toast; only Split, which has to add up first, has a Save. Which
// blocks apply comes from @tally/core/transactionView's
// describeTransactionDetail.
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const rf = useRF();
  const { data: t, isLoading, isError, refetch } = useTransaction(id);
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories ?? [];
  const update = useUpdateTransaction(id ?? "");
  const del = useDeleteTransaction(id ?? "");
  const rulePreview = useMerchantRulePreview(t && !t.isTransfer ? t.merchantName : null);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const [ruleMade, setRuleMade] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<"main" | "split" | "spread">("main");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const loadedId = useRef<string | null>(null);
  const savedNotes = useRef("");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once per transaction; a refetch after a save leaves what's on screen alone.
  useEffect(() => {
    if (!t || loadedId.current === t.id) return;
    loadedId.current = t.id;
    setCategoryId(t.categoryId);
    setReviewed(t.reviewed);
    setExcluded(t.excludedFromBudget);
    setNotes(t.notes ?? "");
    savedNotes.current = t.notes ?? "";
    setTags(t.tags ?? []);
  }, [t]);

  const patch = useCallback(
    async (body: TransactionPatch, opts?: { undo?: TransactionPatch; toast?: string; onUndo?: () => void }): Promise<boolean> => {
      setStatus("saving");
      setRetry(null);
      try {
        await update.mutateAsync(body);
        setStatus("saved");
        if (opts?.toast) {
          const undoBody = opts.undo;
          setToast({
            message: opts.toast,
            undo: undoBody
              ? () => {
                  opts.onUndo?.();
                  void patch(undoBody);
                }
              : undefined,
          });
        }
        return true;
      } catch {
        setStatus("error");
        setRetry(() => () => void patch(body, opts));
        return false;
      }
    },
    [update],
  );

  const nameOf = (cid: string | null) => categories.find((c) => c.id === cid)?.name ?? "Uncategorized";

  function pickCategory(next: string | null) {
    const prev = { categoryId, reviewed };
    setCategoryId(next);
    setReviewed(true);
    setRuleMade(false);
    void patch(
      { categoryId: next, reviewed: true },
      {
        undo: { categoryId: prev.categoryId, reviewed: prev.reviewed },
        toast: next === prev.categoryId ? "Marked reviewed" : `Category set to ${nameOf(next)}`,
        onUndo: () => {
          setCategoryId(prev.categoryId);
          setReviewed(prev.reviewed);
        },
      },
    );
  }

  function setReviewedTo(next: boolean) {
    setReviewed(next);
    void patch({ reviewed: next }, { undo: { reviewed: !next }, toast: next ? "Marked reviewed" : "Marked not reviewed", onUndo: () => setReviewed(!next) });
  }

  function setExcludedTo(next: boolean) {
    if (next === excluded) return;
    setExcluded(next);
    void patch({ excluded: next }, { undo: { excluded: !next }, toast: next ? "Excluded from spend" : "Counts in spend again", onUndo: () => setExcluded(!next) });
  }

  async function makeRule() {
    if (!categoryId) return;
    if (await patch({ categoryId, alwaysCategorizeMerchant: true })) setRuleMade(true);
  }

  function onNotesChange(value: string) {
    setNotes(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => flushNotes(value), NOTE_DEBOUNCE_MS);
  }

  function flushNotes(value = notes) {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    const next = value.trim();
    if (next === savedNotes.current.trim()) return;
    savedNotes.current = next;
    void patch({ notes: next || null });
  }

  function saveTags(next: string[], message: string) {
    const prev = tags;
    setTags(next);
    void patch({ tags: next }, { undo: { tags: prev }, toast: message, onUndo: () => setTags(prev) });
  }

  function addTag() {
    const tag = (tagDraft ?? "").trim();
    setTagDraft(null);
    if (!tag || tags.includes(tag)) return;
    saveTags([...tags, tag], `Tagged ${tag}`);
  }

  function close() {
    flushNotes();
    router.back();
  }

  async function deleteTransaction() {
    setStatus("saving");
    try {
      await del.mutateAsync();
      router.back();
    } catch {
      setStatus("error");
      setRetry(() => () => void deleteTransaction());
    }
  }

  const v = t ? describeTransactionDetail({ ...t, isTransfer: t.isTransfer ?? false, categorySource: t.categorySource, amortizeMonths: t.amortizeMonths ?? null }) : null;

  return (
    // iOS's "modal" (card) presentation already reserves its own space above
    // the content, so a fixed 22px is enough there; Android's "modal" draws
    // edge-to-edge under the status bar and needs the real inset. At the
    // bottom only the safe-area offset is kept -- no extra padding on top.
    <View className="flex-1 bg-raised" style={{ paddingTop: Platform.OS === "ios" ? 22 : insets.top + 12 }}>
      <Stack.Screen options={{ presentation: "modal" }} />

      {view === "main" && (
        <View className="flex-row items-center justify-between px-5 pb-3">
          <SaveStatus status={status} retry={retry} />
          <Pressable onPress={close} hitSlop={8} className="items-center justify-center rounded-full bg-surface-2" style={{ width: 34, height: 34 }} accessibilityLabel="Close">
            <X size={17} color={colors.text} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      {isError ? (
        <View className="mx-5 mt-6 rounded-card bg-surface-2 p-5 items-center gap-2">
          <Text className="font-ui text-text" style={{ fontSize: rf(14) }}>Couldn't load this transaction</Text>
          <Pressable onPress={() => refetch()} hitSlop={8}>
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>Retry</Text>
          </Pressable>
        </View>
      ) : isLoading || !t || !v ? (
        <LoadingSkeleton />
      ) : view === "split" ? (
        <SplitView t={t} categories={categories} defaultCategoryId={categoryId} bottom={insets.bottom} saving={status === "saving"} onBack={() => setView("main")} onSave={async (splits) => {
          const prev = t.splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount, note: s.note }));
          if (await patch({ splits }, { undo: { splits: prev }, toast: splits.length ? `Split across ${splits.length} categories` : "Split removed" })) setView("main");
        }} />
      ) : view === "spread" ? (
        <SpreadView t={t} months={v.spreadMonths} bottom={insets.bottom} onBack={() => setView("main")} onDone={(message) => {
          setToast({ message });
          setView("main");
        }} />
      ) : (
        <ScrollView
          className="px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 22, paddingBottom: insets.bottom }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Header t={t} tone={v.amountTone} reviewed={reviewed} onReviewed={setReviewedTo} />

          {(v.notice || v.isInstallment) && (
            <View className="rounded-control px-3.5 py-3" style={{ backgroundColor: colors.sunken, borderWidth: 1, borderColor: colors.border }}>
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(13) }}>{v.isInstallment ? "One month of a spread plan" : v.notice!.title}</Text>
              <Text className="font-ui text-text-2 mt-0.5" style={{ fontSize: rf(12.5), lineHeight: rf(17) }}>
                {v.isInstallment ? "Change or stop the spread from the original charge." : v.notice!.body}
              </Text>
            </View>
          )}

          {v.canCategorize && !v.isInstallment && (
            <Group label="Category">
              <CategoryCard
                t={t}
                categories={categories}
                categoryId={categoryId}
                sourceText={categoryId === t.categoryId ? v.sourceText : "Set by you"}
                reviewed={reviewed}
                ruleMade={ruleMade}
                rulePreview={rulePreview.data?.previewCount ?? null}
                saving={status === "saving"}
                onChange={() => setPickerOpen(true)}
                onPick={pickCategory}
                onMakeRule={() => void makeRule()}
              />
            </Group>
          )}

          {!t.isTransfer && !v.isInstallment && (
            <Group label="How it counts">
              <Segmented options={["Counts in spend", "Excluded"]} selected={excluded ? 1 : 0} onSelect={(i) => setExcludedTo(i === 1)} />
              <View className="rounded-card overflow-hidden" style={{ backgroundColor: colors["surface-2"] }}>
                {v.canSplit && (
                  <NavRow label="Split across categories" value={t.splits.length > 1 ? `${t.splits.length} categories` : "Not split"} onPress={() => setView("split")} />
                )}
                {v.canSpread && (
                  <NavRow
                    label="Spread a prepaid plan"
                    value={v.spreadMonths ? `${v.spreadMonths} mo · ${formatCents(spreadMonthly(t.amount, v.spreadMonths))}` : "Off"}
                    onPress={() => setView("spread")}
                    divider={v.canSplit}
                  />
                )}
              </View>
            </Group>
          )}

          <Group label="Note and tags">
            <TextInput
              value={notes}
              onChangeText={onNotesChange}
              onBlur={() => flushNotes()}
              placeholder="Add a note"
              placeholderTextColor={colors["text-3"]}
              multiline
              className="rounded-card bg-surface-2 px-[14px] py-3 font-ui text-text"
              style={{ minHeight: 48, textAlignVertical: "top", fontSize: rf(14) }}
            />
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Pressable key={tag} onPress={() => saveTags(tags.filter((x) => x !== tag), `Removed ${tag}`)} className="h-8 px-3 rounded-full bg-surface-2 justify-center" accessibilityLabel={`Remove tag ${tag}`}>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>{tag} ×</Text>
                </Pressable>
              ))}
              {tagDraft !== null ? (
                <TextInput
                  autoFocus
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={addTag}
                  onBlur={addTag}
                  maxLength={40}
                  placeholder="Tag"
                  placeholderTextColor={colors["text-3"]}
                  autoCapitalize="none"
                  returnKeyType="done"
                  className="h-8 px-3 rounded-full bg-surface-2 font-ui text-text"
                  style={{ minWidth: 90, fontSize: rf(13), borderWidth: 1, borderColor: colors["border-strong"] }}
                />
              ) : (
                <Pressable onPress={() => setTagDraft("")} className="h-8 px-3 rounded-full justify-center" style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors["border-strong"] }}>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>+ Tag</Text>
                </Pressable>
              )}
            </View>
          </Group>

          <View className="gap-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable onPress={() => setDetailsOpen((o) => !o)} className="flex-row items-center justify-between" accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }}>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>Details</Text>
              <ChevronDown size={15} color={colors["text-3"]} style={{ transform: [{ rotate: detailsOpen ? "180deg" : "0deg" }] }} />
            </Pressable>
            {detailsOpen && <Details t={t} />}
            {v.canDelete &&
              (confirmDelete ? (
                <View className="rounded-card p-4 gap-3" style={{ backgroundColor: colors.sunken, borderWidth: 1, borderColor: colors.border }}>
                  <View>
                    <Text className="font-ui-semibold text-text" style={{ fontSize: rf(14) }}>Delete {t.merchantName ?? t.name}?</Text>
                    <Text className="font-ui text-text-2 mt-0.5" style={{ fontSize: rf(13) }}>It comes out of your spend. This can't be undone.</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => setConfirmDelete(false)} className="flex-1 h-10 rounded-full items-center justify-center" style={{ borderWidth: 1, borderColor: colors["border-strong"] }}>
                      <Text className="font-ui-semibold text-text" style={{ fontSize: rf(13.5) }}>Keep it</Text>
                    </Pressable>
                    <Pressable onPress={() => void deleteTransaction()} disabled={status === "saving"} className="flex-1 h-10 rounded-full items-center justify-center disabled:opacity-50" style={{ backgroundColor: colors.negative }}>
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(13.5) }}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmDelete(true)} hitSlop={8} className="self-start">
                  <Text className="font-ui-medium" style={{ fontSize: rf(14), color: colors.negative }}>Delete transaction</Text>
                </Pressable>
              ))}
          </View>
        </ScrollView>
      )}

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} selectedId={categoryId} onSelect={(cid) => pickCategory(cid)} />
      <Toast message={toast?.message ?? null} onHidden={() => setToast(null)} action={toast?.undo ? { label: "Undo", onPress: toast.undo } : undefined} bottom={insets.bottom + 8} />
    </View>
  );
}

function useSeries() {
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  return (slot: number | null | undefined) => (slot ? series[(slot - 1) % 8]! : undefined);
}

function SaveStatus({ status, retry }: { status: Status; retry: (() => void) | null }) {
  const colors = useThemeColors();
  const rf = useRF();
  if (status === "error") {
    return (
      <Pressable onPress={retry ?? undefined} hitSlop={8} accessibilityRole="button">
        <Text className="font-ui-medium" style={{ fontSize: rf(13), color: colors.negative }}>Couldn't save · Retry</Text>
      </Pressable>
    );
  }
  if (status === "idle") return <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }}>Transaction</Text>;
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status === "saving" ? colors["text-3"] : colors.positive }} />
      <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>{status === "saving" ? "Saving…" : "Saved"}</Text>
    </View>
  );
}

function Header({ t, tone, reviewed, onReviewed }: { t: TransactionRow; tone: "positive" | "default" | "muted"; reviewed: boolean; onReviewed: (v: boolean) => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const display = t.merchantName ?? t.name;
  const text = formatCents(t.amount, { signed: true });
  const dot = text.lastIndexOf(".");
  const color = tone === "positive" ? colors.positive : tone === "muted" ? colors["text-2"] : colors.text;
  const date = new Date(t.postedDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-[11px] bg-surface-2 items-center justify-center">
          <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(15) }}>{display.charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} numberOfLines={1}>{display}</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }} numberOfLines={1}>
            {date}
            {t.accountName ? ` · ${t.accountName}${t.accountMask ? ` ••${t.accountMask}` : ""}` : ""}
          </Text>
        </View>
      </View>
      <View className="flex-row items-end justify-between gap-3">
        <Text className="font-display" style={{ color, fontSize: rf(40), lineHeight: rf(44), fontVariant: ["tabular-nums"] }} accessibilityLabel={text}>
          {dot === -1 ? text : text.slice(0, dot)}
          {dot !== -1 && <Text style={{ fontSize: rf(22), color: colors["text-3"] }}>{text.slice(dot)}</Text>}
        </Text>
        <Pressable
          onPress={() => onReviewed(!reviewed)}
          className="h-8 px-3.5 rounded-full flex-row items-center gap-1.5 mb-1"
          style={{ backgroundColor: reviewed ? colors["surface-2"] : colors["brand-subtle"] }}
          accessibilityRole="switch"
          accessibilityState={{ checked: reviewed }}
          accessibilityLabel="Reviewed"
        >
          {!reviewed && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} />}
          <Text className="font-ui-semibold" style={{ fontSize: rf(12.5), color: reviewed ? colors["text-2"] : colors.brand }}>{reviewed ? "✓ Reviewed" : "Needs review"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const rf = useRF();
  return (
    <View className="gap-2">
      <Text className="font-ui-semibold text-text-3 px-1" style={{ textTransform: "uppercase", letterSpacing: 0.7, fontSize: rf(11) }}>{label}</Text>
      {children}
    </View>
  );
}

function CategoryCard({
  t,
  categories,
  categoryId,
  sourceText,
  reviewed,
  ruleMade,
  rulePreview,
  saving,
  onChange,
  onPick,
  onMakeRule,
}: {
  t: TransactionRow;
  categories: Category[];
  categoryId: string | null;
  sourceText: string | null;
  reviewed: boolean;
  ruleMade: boolean;
  rulePreview: number | null;
  saving: boolean;
  onChange: () => void;
  onPick: (id: string) => void;
  onMakeRule: () => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const color = useSeries();
  const current = categories.find((c) => c.id === categoryId);
  const isSplit = t.splits.length > 1;
  const splitNames = t.splits.map((s) => categories.find((c) => c.id === s.categoryId)?.name ?? "Uncategorized").join(", ");
  const title = isSplit ? `Split · ${splitNames}` : (current?.name ?? (categoryId ? prettifyPfc(t.pfcDetailed) : "Choose a category"));
  const swatch = color(current?.colorSlot);
  return (
    <View className="rounded-card p-3.5 gap-3" style={{ backgroundColor: colors["surface-2"] }}>
      <Pressable onPress={isSplit ? undefined : onChange} className="flex-row items-center gap-3" accessibilityRole="button" accessibilityLabel={`Category, ${title}. Change`}>
        <View className="w-[30px] h-[30px] rounded-[9px] items-center justify-center" style={{ backgroundColor: swatch ? withAlpha(swatch, 0.16) : colors.sunken }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: swatch ?? colors["text-3"] }} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="font-ui-semibold" style={{ fontSize: rf(15), color: current || isSplit ? colors.text : colors.warning }} numberOfLines={1}>{title}</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{isSplit ? "Edit the split below" : (sourceText ?? "Not categorized yet")}</Text>
        </View>
        {!isSplit && <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>Change</Text>}
      </Pressable>

      {!isSplit && (t.suggestions?.length ?? 0) > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {t.suggestions!.map((s) => {
            const on = s.categoryId === categoryId;
            return (
              <Pressable
                key={s.categoryId}
                onPress={() => onPick(s.categoryId)}
                className="h-8 pl-2.5 pr-3 rounded-full flex-row items-center gap-1.5"
                style={{ backgroundColor: on ? colors["brand-subtle"] : colors.surface }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color(s.colorSlot) }} />
                <Text className={on ? "font-ui-medium" : "font-ui"} style={{ fontSize: rf(13), color: on ? colors.brand : colors["text-2"] }}>
                  {s.name}
                  {on && !reviewed ? " ✓" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!isSplit && t.merchantName && (
        <View className="pt-3 flex-row items-center gap-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
          {ruleMade ? (
            <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(13), lineHeight: rf(18) }}>
              <Text className="font-ui-semibold text-text">{t.merchantName}</Text> now always goes to <Text className="font-ui-semibold text-text">{current?.name}</Text>. Edit it in Rules on the web.
            </Text>
          ) : (
            <>
              <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(13), lineHeight: rf(18), opacity: categoryId ? 1 : 0.5 }}>
                Always use <Text className="font-ui-semibold text-text">{current?.name ?? "this category"}</Text> for <Text className="font-ui-semibold text-text">{t.merchantName}</Text>.
                {rulePreview != null ? ` Changes ${rulePreview} past transaction${rulePreview === 1 ? "" : "s"}.` : ""}
              </Text>
              <Switch
                value={false}
                disabled={!categoryId || saving}
                onValueChange={(on) => {
                  if (on) onMakeRule();
                }}
                trackColor={{ false: colors["border-strong"], true: colors.brand }}
                ios_backgroundColor={colors["border-strong"]}
                accessibilityLabel={`Always use this category for ${t.merchantName}`}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function Segmented({ options, selected, onSelect }: { options: string[]; selected: number; onSelect: (i: number) => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row rounded-control p-1 gap-1" style={{ backgroundColor: colors.surface }} accessibilityRole="radiogroup">
      {options.map((o, i) => (
        <Pressable
          key={o}
          onPress={() => onSelect(i)}
          className="flex-1 h-9 rounded-[8px] items-center justify-center"
          style={{ backgroundColor: i === selected ? colors["surface-2"] : "transparent" }}
          accessibilityRole="radio"
          accessibilityState={{ checked: i === selected }}
        >
          <Text className="font-ui-medium" style={{ fontSize: rf(13), color: i === selected ? colors.text : colors["text-3"] }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NavRow({ label, value, onPress, divider }: { label: string; value: string; onPress: () => void; divider?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-2 px-4 active:opacity-70" style={{ paddingVertical: 13, borderTopWidth: divider ? 1 : 0, borderTopColor: hairline(colors) }} accessibilityRole="button">
      <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(14) }}>{label}</Text>
      <Text className="font-ui text-text" style={{ fontSize: rf(14), fontVariant: ["tabular-nums"] }}>{value}</Text>
      <ChevronRight size={15} color={colors["text-3"]} />
    </Pressable>
  );
}

function Details({ t }: { t: TransactionRow }) {
  const colors = useThemeColors();
  const rf = useRF();
  const rows: [string, string, boolean?][] = [
    ["Original description", t.name, true],
    ["Account", `${t.accountName ?? "—"}${t.accountMask ? ` ••${t.accountMask}` : ""}`],
    ["Status", t.isPending ? "Pending" : "Posted"],
  ];
  if (t.locationLabel) rows.push(["Location", t.locationLabel]);
  const txnId = t.plaidTransactionId ?? t.id;
  return (
    <View className="rounded-card px-4 py-1" style={{ backgroundColor: colors.sunken }}>
      {rows.map(([label, value, mono]) => (
        <View key={label} className="flex-row justify-between gap-4 py-2.5">
          <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>{label}</Text>
          <Text className="font-ui text-text flex-shrink text-right" style={mono ? { fontFamily: "JetBrainsMono", fontSize: 12, color: colors["text-2"] } : { fontSize: rf(13) }}>{value}</Text>
        </View>
      ))}
      {/* Long-press to copy (Text's native selection) -- no clipboard module needed. */}
      <View className="flex-row justify-between gap-4 py-2.5">
        <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>ID</Text>
        <Text selectable className="flex-shrink text-right" style={{ fontFamily: "JetBrainsMono", fontSize: 11.5, color: colors["text-2"] }}>
          {txnId}
        </Text>
      </View>
    </View>
  );
}

function BackBar({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between px-5 pb-4">
      <Pressable onPress={onBack} hitSlop={8} className="flex-row items-center gap-0.5" style={{ minWidth: 64 }} accessibilityRole="button">
        <ChevronLeft size={17} color={colors.brand} />
        <Text className="font-ui-medium text-brand" style={{ fontSize: rf(14.5) }}>Back</Text>
      </Pressable>
      <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{title}</Text>
      <View style={{ minWidth: 64, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

function SplitView({
  t,
  categories,
  defaultCategoryId,
  bottom,
  saving,
  onBack,
  onSave,
}: {
  t: TransactionRow;
  categories: Category[];
  defaultCategoryId: string | null;
  bottom: number;
  saving: boolean;
  onBack: () => void;
  onSave: (splits: { categoryId: string; amount: number }[]) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const color = useSeries();
  const total = Math.abs(t.amount);
  const [lines, setLines] = useState<{ categoryId: string | null; text: string }[]>(() =>
    t.splits.length > 1
      ? t.splits.map((s) => ({ categoryId: s.categoryId, text: (Math.abs(s.amount) / 100).toFixed(2) }))
      : [
          { categoryId: defaultCategoryId, text: (total / 100).toFixed(2) },
          { categoryId: null, text: "0.00" },
        ],
  );
  const [lastEdited, setLastEdited] = useState(0);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const cents = lines.map((l) => Math.round(parseFloat(l.text || "0") * 100) || 0);
  const bal = splitBalance(t.amount, cents);
  const canSave = bal.balanced && lines.every((l) => l.categoryId) && !saving;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const restName = lines[lastEdited]?.categoryId ? byId.get(lines[lastEdited]!.categoryId!)?.name : undefined;

  function setLine(i: number, patch: Partial<{ categoryId: string | null; text: string }>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <>
      <BackBar
        title={`Split ${formatCents(total)}`}
        onBack={onBack}
        right={
          <Pressable disabled={!canSave} onPress={() => onSave(lines.map((l, i) => ({ categoryId: l.categoryId!, amount: cents[i]! })))} hitSlop={8}>
            <Text className="font-ui-semibold" style={{ fontSize: rf(14.5), color: canSave ? colors.brand : colors["text-3"] }}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        }
      />
      <ScrollView className="px-5" contentContainerStyle={{ gap: 14, paddingBottom: bottom }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="flex-row h-2 rounded-full overflow-hidden" style={{ gap: 2, backgroundColor: colors.sunken }}>
          {lines.map((l, i) => (
            <View key={i} style={{ flex: Math.max(0, cents[i]!), backgroundColor: color(byId.get(l.categoryId ?? "")?.colorSlot) ?? colors["text-3"] }} />
          ))}
          {bal.remaining > 0 && <View style={{ flex: bal.remaining, backgroundColor: withAlpha(colors.warning, 0.5) }} />}
        </View>
        <View className="rounded-card overflow-hidden" style={{ backgroundColor: colors["surface-2"] }}>
          {lines.map((l, i) => {
            const c = l.categoryId ? byId.get(l.categoryId) : undefined;
            return (
              <View key={i} className="flex-row items-center gap-2.5 px-4" style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: hairline(colors) }}>
                <Pressable onPress={() => setPickerFor(i)} className="flex-1 flex-row items-center gap-2 min-w-0" accessibilityRole="button">
                  {c && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color(c.colorSlot) }} />}
                  <Text className="font-ui" style={{ fontSize: rf(14.5), color: c ? colors.text : colors.warning }} numberOfLines={1}>{c?.name ?? "Choose category"}</Text>
                </Pressable>
                <TextInput
                  value={l.text}
                  onChangeText={(x) => {
                    setLine(i, { text: x.replace(/[^0-9.]/g, "") });
                    setLastEdited(i);
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  className="rounded-[9px] px-2.5 font-ui text-text text-right"
                  style={{ minWidth: 92, height: 36, fontSize: rf(14.5), fontVariant: ["tabular-nums"], backgroundColor: colors.sunken, borderWidth: 1, borderColor: colors.border }}
                  accessibilityLabel={`Amount for ${c?.name ?? `line ${i + 1}`}`}
                />
                {lines.length > 2 && (
                  <Pressable onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove line">
                    <X size={15} color={colors["text-3"]} />
                  </Pressable>
                )}
              </View>
            );
          })}
          <Pressable onPress={() => setLines((ls) => [...ls, { categoryId: null, text: (Math.max(0, bal.remaining) / 100).toFixed(2) }])} className="px-4" style={{ paddingVertical: 13, borderTopWidth: 1, borderTopColor: hairline(colors) }}>
            <Text className="font-ui-medium text-brand" style={{ fontSize: rf(14) }}>+ Add a category</Text>
          </Pressable>
        </View>
        {bal.remaining !== 0 && (
          <View className="rounded-control px-3.5 py-3" style={{ backgroundColor: colors["warning-subtle"] }}>
            <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: colors.warning }}>
              {bal.remaining > 0 ? `${formatCents(bal.remaining)} left to assign` : `${formatCents(-bal.remaining)} more than the total`}
            </Text>
            <Text className="font-ui text-text-2 mt-0.5" style={{ fontSize: rf(12.5) }}>The lines have to add up to {formatCents(total)}.</Text>
          </View>
        )}
        <View className="flex-row gap-2">
          {bal.remaining > 0 && restName && (
            <Pressable onPress={() => setLine(lastEdited, { text: ((cents[lastEdited]! + bal.remaining) / 100).toFixed(2) })} className="flex-1 h-10 rounded-full items-center justify-center px-3" style={{ backgroundColor: colors["brand-subtle"] }}>
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }} numberOfLines={1}>Put the rest in {restName}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              const even = splitEvenly(t.amount, lines.length);
              setLines((ls) => ls.map((l, i) => ({ ...l, text: (even[i]! / 100).toFixed(2) })));
            }}
            className="flex-1 h-10 rounded-full items-center justify-center"
            style={{ borderWidth: 1, borderColor: colors["border-strong"] }}
          >
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(13) }}>Split evenly</Text>
          </Pressable>
        </View>
        {t.splits.length > 1 && (
          <Pressable onPress={() => onSave([])} disabled={saving} hitSlop={8} className="self-start">
            <Text className="font-ui-medium" style={{ fontSize: rf(14), color: colors.negative }}>Remove the split</Text>
          </Pressable>
        )}
      </ScrollView>
      <CategoryPickerSheet
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        selectedId={pickerFor !== null ? (lines[pickerFor]?.categoryId ?? null) : null}
        includeUncategorized={false}
        onSelect={(cid) => {
          if (pickerFor !== null) setLine(pickerFor, { categoryId: cid });
          setPickerFor(null);
        }}
      />
    </>
  );
}

function SpreadView({ t, months, bottom, onBack, onDone }: { t: TransactionRow; months: number | null; bottom: number; onBack: () => void; onDone: (message: string) => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const markAnnual = useMarkAnnual(t.id);
  const updateSpread = useUpdateSpread(t.id);
  const [term, setTerm] = useState<(typeof TERMS)[number]>((TERMS.find((m) => m === months) ?? 12) as (typeof TERMS)[number]);
  const [error, setError] = useState<string | null>(null);
  const busy = markAnnual.isPending || updateSpread.isPending;
  const start = new Date(t.postedDate + "T00:00:00Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + term - 1, 1));
  const monthName = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await action();
      onDone(message);
    } catch {
      setError("Couldn't update the spread. Try again.");
    }
  }

  return (
    <>
      <BackBar title="Spread" onBack={onBack} />
      <ScrollView className="px-5" contentContainerStyle={{ gap: 16, paddingBottom: bottom }}>
        <View>
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{t.merchantName ?? t.name}</Text>
          <Text className="font-ui text-text-3 mt-0.5" style={{ fontSize: rf(13) }}>
            {new Date(t.postedDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · {formatCents(t.amount, { signed: true })}
          </Text>
        </View>
        <Group label="It's paid every">
          <Segmented options={TERMS.map((m) => `${m} mo`)} selected={TERMS.indexOf(term)} onSelect={(i) => setTerm(TERMS[i]!)} />
        </Group>
        <View className="rounded-control px-3.5 py-3" style={{ backgroundColor: colors["brand-subtle"], borderWidth: 1, borderColor: colors["brand-border"] }}>
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }}>
            {formatCents(spreadMonthly(t.amount, term))} a month, {monthName(start)} to {monthName(end)}
          </Text>
          <Text className="font-ui text-text-2 mt-1" style={{ fontSize: rf(12.5), lineHeight: rf(17) }}>Each month's budget gets one share instead of the whole charge landing in one month.</Text>
        </View>
        {error && <Text className="font-ui" style={{ fontSize: rf(13), color: colors.negative }}>{error}</Text>}
        {months == null ? (
          <Pressable onPress={() => void run(() => markAnnual.mutateAsync(term), `Spread over ${term} months`)} disabled={busy} className="h-12 rounded-full bg-brand items-center justify-center disabled:opacity-50">
            <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>{busy ? "Spreading…" : `Spread over ${term} months`}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => void run(() => updateSpread.mutateAsync({ streamId: t.recurringStreamId!, body: { amortizeMonths: term } }), `Now spread over ${term} months`)}
              disabled={busy || term === months}
              className="h-12 rounded-full bg-brand items-center justify-center disabled:opacity-40"
            >
              <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(15) }}>{term === months ? `Spread over ${months} months` : `Change to ${term} months`}</Text>
            </Pressable>
            <Pressable onPress={() => void run(() => updateSpread.mutateAsync({ streamId: t.recurringStreamId!, body: { amortizeMonthly: false } }), "Stopped spreading")} disabled={busy} hitSlop={8} className="self-start">
              <Text className="font-ui-medium" style={{ fontSize: rf(14), color: colors.negative }}>Stop spreading</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <View className="px-5 gap-4" accessibilityLabel="Loading transaction">
      <View className="flex-row items-center gap-3">
        <Skeleton style={{ width: 40, height: 40, borderRadius: 11 }} />
        <View className="flex-1 gap-2">
          <Skeleton style={{ width: "55%", height: 14 }} />
          <Skeleton style={{ width: "40%", height: 10 }} />
        </View>
      </View>
      <Skeleton style={{ width: "45%", height: 40 }} />
      <Skeleton style={{ height: 120, borderRadius: 16 }} />
      <Skeleton style={{ height: 96, borderRadius: 16 }} />
    </View>
  );
}
