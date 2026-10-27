import fs from "node:fs";
import path from "node:path";
import { formatCents, formatPercent } from "@tally/core/money";
import type { MonthlyRecapData } from "@/lib/monthlyRecap";
import type { GoalSummary } from "@/lib/goals";
import { GOAL_STATUS_LABEL, goalLine } from "@/lib/goalCopy";

const TEMPLATE_PATH = path.join(process.cwd(), "emails", "month-in-review.html");
// Tally Pop's version (users.ui_look = "pop", lib/uiLook.ts): same tokens and blocks.
const POP_TEMPLATE_PATH = path.join(process.cwd(), "emails", "month-in-review-pop.html");

/** Which template a recap uses. */
export type EmailLook = "classic" | "pop";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripBlock(html: string, name: string, keep: boolean): string {
  const re = new RegExp(`<!--BLOCK:${name}-->([\\s\\S]*?)<!--\\/BLOCK:${name}-->`, "g");
  return html.replace(re, (_match, inner: string) => (keep ? inner : ""));
}

function budgetRowHtml(b: MonthlyRecapData["budgets"][number]): string {
  const name = escapeHtml(b.categoryName);
  const spend = formatCents(b.spend);
  const budgeted = formatCents(b.budgeted);

  if (b.overBy != null) {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td style="font-family:'Inter', sans-serif; font-size:14px; color:#1A1917;">${name}</td>
          <td align="right" style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:13px; color:#B3372A;">${spend} / ${budgeted}</td>
        </tr>
      </table>
      <table role="presentation" width="240" cellpadding="0" cellspacing="0" border="0" style="margin:-10px 0 4px 0;">
        <tr style="height:6px;">
          <td width="240" height="6" style="background-color:#B3372A; border-radius:3px; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
      </table>
      <div style="font-family:'Inter', sans-serif; font-size:12px; color:#B3372A; padding-bottom:16px;">${formatCents(b.overBy)} over budget</div>`;
  }

  const pctUsed = b.budgeted > 0 ? Math.min(1, b.spend / b.budgeted) : b.spend > 0 ? 1 : 0;
  const filled = Math.round(240 * pctUsed);
  const remaining = 240 - filled;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="font-family:'Inter', sans-serif; font-size:14px; color:#1A1917;">${name}</td>
        <td align="right" style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:13px; color:#4D4B45;">${spend} / ${budgeted}</td>
      </tr>
    </table>
    <table role="presentation" width="240" cellpadding="0" cellspacing="0" border="0" style="margin:-10px 0 16px 0;">
      <tr style="height:6px;">
        <td width="${filled}" height="6" style="background-color:#237A3B; border-radius:3px 0 0 3px; font-size:0; line-height:0;">&nbsp;</td>
        <td width="${remaining}" height="6" style="background-color:#ECEBE6; border-radius:0 3px 3px 0; font-size:0; line-height:0;">&nbsp;</td>
      </tr>
    </table>`;
}

function categoryRowHtml(c: MonthlyRecapData["categories"][number]): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
      <tr>
        <td width="14" style="background-color:${c.color}; border-radius:2px; font-size:0; line-height:0;">&nbsp;</td>
        <td width="8" style="font-size:0; line-height:0;">&nbsp;</td>
        <td style="font-family:'Inter', sans-serif; font-size:14px; color:#1A1917;">${escapeHtml(c.label)}</td>
        <td align="right" style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:13px; color:#4D4B45;">${formatCents(c.amount)} &middot; ${formatPercent(c.pct)}</td>
      </tr>
    </table>`;
}

function netWorthDeltaChipHtml(data: MonthlyRecapData): string {
  if (data.netWorthDeltaAmount == null || data.netWorthDeltaPct == null || data.netWorthDeltaDirection == null) return "";
  const up = data.netWorthDeltaDirection === "up";
  const color = up ? "#237A3B" : "#B3372A";
  const bg = up ? "#E6F1E8" : "#F8E8E5";
  const arrow = up ? "&#9650;" : "&#9660;";
  return `<div style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:14px; color:${color}; background-color:${bg}; padding:6px 10px; border-radius:6px; display:inline-block;">${arrow} ${formatCents(Math.abs(data.netWorthDeltaAmount))} &middot; ${formatPercent(Math.abs(data.netWorthDeltaPct))}</div>`;
}

function netWorthMonthLabelsHtml(labels: string[]): string {
  const n = labels.length;
  if (n === 0) return "";
  const width = (100 / n).toFixed(1);
  return labels
    .map((label, i) => {
      const isLast = i === n - 1;
      const style = isLast
        ? `font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:11px; color:#1A1917; font-weight:600;`
        : `font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:11px; color:#65635C;`;
      return `<td width="${width}%"${isLast ? ' align="right"' : ""} style="${style}">${escapeHtml(label)}</td>`;
    })
    .join("\n");
}

function subPriceIncreaseHtml(data: MonthlyRecapData): string {
  const p = data.priceIncrease;
  if (!p) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; background-color:#F8E8E5; border-radius:8px;">
      <tr>
        <td style="padding:12px 14px; font-family:'Inter', sans-serif; font-size:13px; color:#B3372A; line-height:1.5;">
          <strong>${escapeHtml(p.label)}</strong> renewed at ${formatCents(p.newAmount)}, up from ${formatCents(p.oldAmount)} (+${p.pctIncrease}).
        </td>
      </tr>
    </table>`;
}

function budgetsFootnoteHtml(data: MonthlyRecapData): string {
  if (data.budgetsOmitted <= 0) return "";
  return `<div style="font-family:'Inter', sans-serif; font-size:12px; color:#65635C; padding-top:4px;">+${data.budgetsOmitted} more in the full report</div>`;
}

function fireSentenceHtml(data: MonthlyRecapData): string {
  const fire = data.fire;
  if (!fire) return "";
  if (fire.yearsToGo <= 0) return "You've already hit your FIRE number.";

  const years = fire.yearsToGo.toFixed(1);
  let sentence = `That's <strong>${years} years</strong> to go`;
  if (fire.yearsSoonerThanLastMonth != null && Math.abs(fire.yearsSoonerThanLastMonth) >= 0.05) {
    const abs = Math.abs(fire.yearsSoonerThanLastMonth).toFixed(1);
    const direction = fire.yearsSoonerThanLastMonth > 0 ? "sooner" : "later";
    sentence += `, ${abs} years ${direction} than last month`;
  }
  return `${sentence}.`;
}

function preheaderText(data: MonthlyRecapData): string {
  if (data.saved >= 0) return `You saved ${formatCents(data.saved)} in ${data.monthLabel}.`;
  return `You spent ${formatCents(Math.abs(data.saved))} more than you earned in ${data.monthLabel}.`;
}

function greetingText(data: MonthlyRecapData): string {
  if (!data.userName) return "Here's how your money moved last month.";
  return `Hi ${escapeHtml(data.userName)}, here's how your money moved last month.`;
}

function savingsRateLineText(data: MonthlyRecapData): string {
  const pct = formatPercent(data.savingsRate);
  const base = `A ${pct} savings rate`;
  if (data.bestMonthLine) return `${base}, ${data.bestMonthLine}`;
  return `${base}.`;
}

function subCountLineText(data: MonthlyRecapData): string {
  const n = data.subscriptionsActiveCount;
  return `${n} active subscription${n === 1 ? "" : "s"}.`;
}

// ---- Tally Pop rows. Inline styles only (email clients); every text pair AA.
const POP_FONT = "Figtree, Arial, Helvetica, sans-serif";
const POP_DISPLAY = "'Bricolage Grotesque', Arial, Helvetica, sans-serif";
const POP_INK = "#1D1B2F";
const POP_TEXT2 = "#4A4760";
const POP_NEGATIVE = "#C2341F";
const POP_TRACK = "#F8EDDB";
// The chart series in their fixed order (DESIGN.md §7.1), for budget fills.
const POP_SERIES = ["#1baf7a", "#eb6834", "#2a78d6", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

/** One budget: name and "$X under" / "⊘ $X over", then an outlined meter with the overage in red. */
function budgetRowHtmlPop(b: MonthlyRecapData["budgets"][number], i: number): string {
  const name = escapeHtml(b.categoryName);
  const fill = POP_SERIES[i % POP_SERIES.length]!;
  const over = b.overBy != null;
  const right = over
    ? `<span style="color:${POP_NEGATIVE}; font-weight:800;">&#8856; ${formatCents(b.overBy!)} over ${formatCents(b.budgeted)}</span>`
    : `<span style="color:${POP_TEXT2};">${formatCents(b.spend)} of ${formatCents(b.budgeted)} &middot; </span><strong style="color:${POP_INK};">${formatCents(b.budgeted - b.spend)} under</strong>`;
  // Over budget: the budget's share in its color, the overage in red.
  const pct = over ? (b.spend > 0 ? b.budgeted / b.spend : 0) : b.budgeted > 0 ? Math.min(1, b.spend / b.budgeted) : b.spend > 0 ? 1 : 0;
  const filled = Math.round(pct * 100);
  const cells = over
    ? `<td width="${filled}%" height="10" style="background-color:${fill}; font-size:0; line-height:0;">&nbsp;</td><td height="10" style="background-color:${POP_NEGATIVE}; font-size:0; line-height:0;">&nbsp;</td>`
    : `${filled > 0 ? `<td width="${filled}%" height="10" style="background-color:${fill}; font-size:0; line-height:0;">&nbsp;</td>` : ""}<td height="10" style="font-size:0; line-height:0;">&nbsp;</td>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-family:${POP_FONT}; font-size:15px; font-weight:700; color:${POP_INK};">${name}</td>
        <td align="right" class="num" style="font-family:${POP_FONT}; font-size:14px;">${right}</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 16px 0; border:2px solid ${POP_INK}; border-radius:999px; background-color:${POP_TRACK}; overflow:hidden;">
      <tr style="height:10px;">${cells}</tr>
    </table>`;
}

/** One category: label and amount inside the card's padding, then its bar from the card's left edge. */
function categoryRowHtmlPop(c: MonthlyRecapData["categories"][number], max: number): string {
  const width = Math.max(2, Math.round((c.amount / (max || 1)) * 94));
  return `
    <tr>
      <td class="pad-sm" style="padding:10px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${POP_FONT}; font-size:14.5px; font-weight:700; color:${POP_INK};">${escapeHtml(c.label)}</td>
            <td align="right" class="num" style="font-family:${POP_FONT}; font-size:14.5px; color:${POP_INK};">${formatCents(c.amount)} &middot; ${formatPercent(c.pct)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="${width}%" cellpadding="0" cellspacing="0" border="0">
          <tr style="height:18px;"><td height="18" style="background-color:${c.color}; border:2px solid ${POP_INK}; border-left:0; border-radius:0 8px 8px 0; font-size:0; line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>`;
}

/** A white pill on the brand card: arrow + amount + percent, in money color. */
function netWorthDeltaChipHtmlPop(data: MonthlyRecapData): string {
  if (data.netWorthDeltaAmount == null || data.netWorthDeltaPct == null || data.netWorthDeltaDirection == null) return "";
  const up = data.netWorthDeltaDirection === "up";
  const color = up ? "#0F7A43" : POP_NEGATIVE;
  const arrow = up ? "&#9650;" : "&#9660;";
  return `<span class="num" style="display:inline-block; background-color:#FFFFFF; color:${color}; border:2px solid ${POP_INK}; border-radius:999px; padding:4px 12px; font-family:${POP_FONT}; font-size:14px; font-weight:800;">${arrow} ${formatCents(Math.abs(data.netWorthDeltaAmount))} &middot; ${formatPercent(Math.abs(data.netWorthDeltaPct))} since last month</span>`;
}

function netWorthMonthLabelsHtmlPop(labels: string[]): string {
  const n = labels.length;
  if (n === 0) return "";
  const width = (100 / n).toFixed(1);
  return labels
    .map((label, i) => {
      const align = i === 0 ? "left" : i === n - 1 ? "right" : "center";
      return `<td width="${width}%" align="${align}" style="font-family:${POP_FONT}; font-size:12px; color:#E6E0FF;${i === n - 1 ? " font-weight:800;" : ""}">${escapeHtml(label)}</td>`;
    })
    .join("\n");
}

function subPriceIncreaseHtmlPop(data: MonthlyRecapData): string {
  const p = data.priceIncrease;
  if (!p) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; background-color:#FFF1DC; border-radius:12px;">
      <tr>
        <td class="num" style="padding:12px 14px; font-family:${POP_FONT}; font-size:14px; color:${POP_INK}; line-height:1.5;">
          <strong>${escapeHtml(p.label)} went up.</strong> ${formatCents(p.oldAmount)} &rarr; ${formatCents(p.newAmount)} (+${p.pctIncrease}).
        </td>
      </tr>
    </table>`;
}

function budgetsFootnoteHtmlPop(data: MonthlyRecapData): string {
  if (data.budgetsOmitted <= 0) return "";
  return `<div style="font-family:${POP_FONT}; font-size:13px; color:${POP_TEXT2};">+${data.budgetsOmitted} more in the app</div>`;
}

function greetingTextPop(data: MonthlyRecapData): string {
  const name = data.userName ? `, ${escapeHtml(data.userName)}` : "";
  if (data.saved >= 0) return `Hi${name}! You kept <strong class="num">${formatCents(data.saved)}</strong> in ${escapeHtml(data.monthLabel)}. Here&rsquo;s how it added up.`;
  return `Hi${name}. ${escapeHtml(data.monthLabel)} went <strong class="num">${formatCents(Math.abs(data.saved))}</strong> past what came in. Here&rsquo;s where it went.`;
}

export interface RenderContext {
  appUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  // Not required — this is an internal tool, not a commercial mailer, so
  // there's no CAN-SPAM obligation to publish a physical address. Shown in
  // the footer when both are set, omitted entirely otherwise.
  companyName?: string;
  companyAddress?: string;
}

function companyLineHtml(ctx: RenderContext): string {
  if (!ctx.companyName || !ctx.companyAddress) return "";
  return `<br /><br />${escapeHtml(ctx.companyName)}, ${escapeHtml(ctx.companyAddress)}`;
}

export function renderMonthInReviewEmail(data: MonthlyRecapData, ctx: RenderContext, look: EmailLook = "classic", goal: GoalSummary | null = null): string {
  const pop = look === "pop";
  let html = fs.readFileSync(pop ? POP_TEMPLATE_PATH : TEMPLATE_PATH, "utf-8");
  // The year-end goal (Pop template only; the classic one has no GOAL block).
  html = stripBlock(html, "GOAL", pop && goal != null);

  html = stripBlock(html, "BUDGETS", data.hasBudgets);
  html = stripBlock(html, "CATEGORIES", data.hasCategories);
  html = stripBlock(html, "SUBSCRIPTIONS", data.hasSubscriptions);
  html = stripBlock(html, "FIRE", data.fire != null);
  html = stripBlock(html, "SPARKLINE", data.hasSparkline);

  const fire = data.fire;
  const progressClamped = fire ? Math.min(1, Math.max(0, fire.progressPct)) : 0;
  const fireBarFilled = Math.round(240 * progressClamped);
  const categoryMax = Math.max(0, ...data.categories.map((c) => c.amount));

  const tokens: Record<string, string> = {
    MONTH_LABEL: data.monthLabel,
    PREHEADER: escapeHtml(preheaderText(data)),
    GREETING: pop ? greetingTextPop(data) : greetingText(data),
    INCOME: formatCents(data.income),
    SPEND: formatCents(data.spend),
    SAVED: formatCents(data.saved, { signed: true }),
    // Pop prints Saved on marigold: ink when kept, red (large, bold: 3:1 is enough) when over.
    SAVED_COLOR: pop ? (data.saved >= 0 ? POP_INK : POP_NEGATIVE) : data.saved >= 0 ? "#237A3B" : "#B3372A",
    SAVINGS_RATE_LINE: savingsRateLineText(data),
    BUDGET_ROWS: pop ? data.budgets.map(budgetRowHtmlPop).join("\n") : data.budgets.map(budgetRowHtml).join("\n"),
    BUDGETS_FOOTNOTE: pop ? budgetsFootnoteHtmlPop(data) : budgetsFootnoteHtml(data),
    CATEGORY_ROWS: pop ? data.categories.map((c) => categoryRowHtmlPop(c, categoryMax)).join("\n") : data.categories.map(categoryRowHtml).join("\n"),
    NET_WORTH: formatCents(data.netWorth),
    NET_WORTH_DELTA_CHIP: pop ? netWorthDeltaChipHtmlPop(data) : netWorthDeltaChipHtml(data),
    NW_FILL_PATH: data.sparklineFillPath,
    NW_LINE_PATH: data.sparklinePath,
    NW_LAST_X: data.sparklineLastX.toFixed(1),
    NW_LAST_Y: data.sparklineLastY.toFixed(1),
    NW_MONTH_LABELS: pop ? netWorthMonthLabelsHtmlPop(data.sparklineLabels) : netWorthMonthLabelsHtml(data.sparklineLabels),
    SUB_MONTHLY_TOTAL: formatCents(data.subscriptionsMonthlyTotal),
    SUB_COUNT_LINE: subCountLineText(data),
    SUB_PRICE_INCREASE_BLOCK: pop ? subPriceIncreaseHtmlPop(data) : subPriceIncreaseHtml(data),
    FIRE_AGE: fire ? String(fire.onPaceAge) : "",
    FIRE_YEAR: fire ? String(fire.onPaceYear) : "",
    FIRE_SENTENCE: fireSentenceHtml(data),
    FIRE_BAR_FILLED: String(fireBarFilled),
    FIRE_BAR_REMAINING: String(240 - fireBarFilled),
    FIRE_BAR_FILLED_PCT: String(Math.round(progressClamped * 100)),
    GOAL_FIGURE: goal ? `${formatCents(goal.projection.current)} of ${formatCents(goal.projection.target)}` : "",
    GOAL_PCT: goal ? String(Math.max(2, Math.round(goal.projection.progress * 100))) : "0",
    GOAL_VERDICT: goal ? escapeHtml(GOAL_STATUS_LABEL[goal.projection.status]) : "",
    GOAL_LINE: goal ? escapeHtml(goalLine(goal)) : "",
    FIRE_CURRENT: fire ? formatCents(fire.currentValue) : "",
    FIRE_TARGET: fire ? formatCents(fire.fireNumberValue) : "",
    FIRE_PROGRESS_PCT: fire ? formatPercent(Math.max(0, fire.progressPct)) : "",
    APP_URL: ctx.appUrl,
    PREFERENCES_URL: ctx.preferencesUrl,
    UNSUBSCRIBE_URL: ctx.unsubscribeUrl,
    COMPANY_LINE: companyLineHtml(ctx),
  };

  for (const [key, value] of Object.entries(tokens)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  return html;
}
