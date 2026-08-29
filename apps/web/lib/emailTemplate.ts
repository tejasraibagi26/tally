import fs from "node:fs";
import path from "node:path";
import { formatCents, formatPercent } from "@tally/core/money";
import type { MonthlyRecapData } from "@/lib/monthlyRecap";

const TEMPLATE_PATH = path.join(process.cwd(), "emails", "month-in-review.html");

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
          <td align="right" style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:13px; color:#B23A2C;">${spend} / ${budgeted}</td>
        </tr>
      </table>
      <table role="presentation" width="240" cellpadding="0" cellspacing="0" border="0" style="margin:-10px 0 4px 0;">
        <tr style="height:6px;">
          <td width="240" height="6" style="background-color:#B23A2C; border-radius:3px; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
      </table>
      <div style="font-family:'Inter', sans-serif; font-size:12px; color:#B23A2C; padding-bottom:16px;">${formatCents(b.overBy)} over budget</div>`;
  }

  const pctUsed = b.budgeted > 0 ? Math.min(1, b.spend / b.budgeted) : b.spend > 0 ? 1 : 0;
  const filled = Math.round(240 * pctUsed);
  const remaining = 240 - filled;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="font-family:'Inter', sans-serif; font-size:14px; color:#1A1917;">${name}</td>
        <td align="right" style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:13px; color:#524F47;">${spend} / ${budgeted}</td>
      </tr>
    </table>
    <table role="presentation" width="240" cellpadding="0" cellspacing="0" border="0" style="margin:-10px 0 16px 0;">
      <tr style="height:6px;">
        <td width="${filled}" height="6" style="background-color:#0F7A57; border-radius:3px 0 0 3px; font-size:0; line-height:0;">&nbsp;</td>
        <td width="${remaining}" height="6" style="background-color:#EFEDE8; border-radius:0 3px 3px 0; font-size:0; line-height:0;">&nbsp;</td>
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
        <td align="right" style="font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:13px; color:#524F47;">${formatCents(c.amount)} &middot; ${formatPercent(c.pct)}</td>
      </tr>
    </table>`;
}

function netWorthDeltaChipHtml(data: MonthlyRecapData): string {
  if (data.netWorthDeltaAmount == null || data.netWorthDeltaPct == null || data.netWorthDeltaDirection == null) return "";
  const up = data.netWorthDeltaDirection === "up";
  const color = up ? "#0F7A57" : "#B23A2C";
  const bg = up ? "#E3F0EA" : "#F6E7E4";
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
        : `font-family:'JetBrains Mono', ui-monospace, Consolas, monospace; font-size:11px; color:#6A665E;`;
      return `<td width="${width}%"${isLast ? ' align="right"' : ""} style="${style}">${escapeHtml(label)}</td>`;
    })
    .join("\n");
}

function subPriceIncreaseHtml(data: MonthlyRecapData): string {
  const p = data.priceIncrease;
  if (!p) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; background-color:#F6E7E4; border-radius:8px;">
      <tr>
        <td style="padding:12px 14px; font-family:'Inter', sans-serif; font-size:13px; color:#B23A2C; line-height:1.5;">
          <strong>${escapeHtml(p.label)}</strong> renewed at ${formatCents(p.newAmount)}, up from ${formatCents(p.oldAmount)} (+${p.pctIncrease}).
        </td>
      </tr>
    </table>`;
}

function budgetsFootnoteHtml(data: MonthlyRecapData): string {
  if (data.budgetsOmitted <= 0) return "";
  return `<div style="font-family:'Inter', sans-serif; font-size:12px; color:#6A665E; padding-top:4px;">+${data.budgetsOmitted} more in the full report</div>`;
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

export function renderMonthInReviewEmail(data: MonthlyRecapData, ctx: RenderContext): string {
  let html = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  html = stripBlock(html, "BUDGETS", data.hasBudgets);
  html = stripBlock(html, "CATEGORIES", data.hasCategories);
  html = stripBlock(html, "SUBSCRIPTIONS", data.hasSubscriptions);
  html = stripBlock(html, "FIRE", data.fire != null);
  html = stripBlock(html, "SPARKLINE", data.hasSparkline);

  const fire = data.fire;
  const progressClamped = fire ? Math.min(1, Math.max(0, fire.progressPct)) : 0;
  const fireBarFilled = Math.round(240 * progressClamped);

  const tokens: Record<string, string> = {
    MONTH_LABEL: data.monthLabel,
    PREHEADER: escapeHtml(preheaderText(data)),
    GREETING: greetingText(data),
    INCOME: formatCents(data.income),
    SPEND: formatCents(data.spend),
    SAVED: formatCents(data.saved, { signed: true }),
    SAVED_COLOR: data.saved >= 0 ? "#0F7A57" : "#B23A2C",
    SAVINGS_RATE_LINE: savingsRateLineText(data),
    BUDGET_ROWS: data.budgets.map(budgetRowHtml).join("\n"),
    BUDGETS_FOOTNOTE: budgetsFootnoteHtml(data),
    CATEGORY_ROWS: data.categories.map(categoryRowHtml).join("\n"),
    NET_WORTH: formatCents(data.netWorth),
    NET_WORTH_DELTA_CHIP: netWorthDeltaChipHtml(data),
    NW_FILL_PATH: data.sparklineFillPath,
    NW_LINE_PATH: data.sparklinePath,
    NW_LAST_X: data.sparklineLastX.toFixed(1),
    NW_LAST_Y: data.sparklineLastY.toFixed(1),
    NW_MONTH_LABELS: netWorthMonthLabelsHtml(data.sparklineLabels),
    SUB_MONTHLY_TOTAL: formatCents(data.subscriptionsMonthlyTotal),
    SUB_COUNT_LINE: subCountLineText(data),
    SUB_PRICE_INCREASE_BLOCK: subPriceIncreaseHtml(data),
    FIRE_AGE: fire ? String(fire.onPaceAge) : "",
    FIRE_YEAR: fire ? String(fire.onPaceYear) : "",
    FIRE_SENTENCE: fireSentenceHtml(data),
    FIRE_BAR_FILLED: String(fireBarFilled),
    FIRE_BAR_REMAINING: String(240 - fireBarFilled),
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
