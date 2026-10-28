import type { AlertType } from "@tally/core/alerts";
import { unsubscribeToken } from "@/lib/emailUnsubscribe";
import { openLinkPath } from "@tally/core/appLinks";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Per-type wording around the alert's own title and body. */
const COPY: Record<AlertType, { label: string; why: string; cta: string; settingName: string }> = {
  budget_threshold: {
    label: "Budget alert",
    why: "This counts everything spent in the category so far this month, including anything rolled over from last month.",
    cta: "View budgets",
    settingName: "budget alerts",
  },
  connection_broken: {
    label: "Connection alert",
    why: "Until you reconnect, new transactions and balances from this bank won't show up in Tally.",
    cta: "Reconnect",
    settingName: "connection alerts",
  },
  large_transaction: {
    label: "Large purchase",
    why: "Tally flags any single charge over your large-purchase amount, or well above what you usually spend there. If you don't recognize it, contact your bank or card issuer.",
    cta: "View transaction",
    settingName: "large purchase alerts",
  },
  goal_off_track: {
    label: "Goal alert",
    why: "Tally projects your year-end goal from how fast your net worth grew over the last 3 full months. This alert comes at most once a month.",
    cta: "View your goal",
    settingName: "goal alerts",
  },
  safe_to_spend_low: {
    label: "Safe to spend",
    why: "Safe to spend is the cash in your spending accounts, minus bills and card payments due before payday and your cushion. This alert comes at most once per pay period.",
    cta: "See the breakdown",
    settingName: "safe to spend alerts",
  },
  subscription_change: {
    label: "Subscription alert",
    why: "Tally spotted this from your recent charges. You can review or remove subscriptions at any time.",
    cta: "Review subscriptions",
    settingName: "subscription alerts",
  },
};

/** "Tally · Dining is at 82%" */
export function alertEmailSubject(title: string): string {
  return `Tally · ${title}`;
}

/**
 * One alert as an email (ALERTS.md §5.2). Light v2 palette, inline styles
 * only (email clients). The footer says exactly which setting sent it, links
 * to Settings → Alerts, and has a one-click link that turns off alert email
 * only; recaps keep their own switch.
 */
export function alertEmailHtml(opts: { type: AlertType; title: string; body: string; url: string; appUrl: string; userId: string; pop?: boolean }): string {
  if (opts.pop) return alertEmailHtmlPop(opts);
  const copy = COPY[opts.type];
  const title = opts.title;
  const open = `${opts.appUrl}${openLinkPath(opts.url)}`;
  const manage = `${opts.appUrl}/settings#alerts`;
  const unsub = `${opts.appUrl}/api/email/unsubscribe?uid=${opts.userId}&token=${unsubscribeToken(opts.userId)}&kind=alerts`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F1F0EC;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1917;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(opts.body)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F0EC;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 4px 16px;font-family:Georgia,serif;font-size:22px;color:#1A1917;">Tally</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E3E1DB;border-radius:12px;padding:24px;">
<div style="font-size:12px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:#65635C;margin-bottom:8px;">${esc(copy.label)}</div>
<div style="font-size:20px;font-weight:600;line-height:1.3;margin-bottom:6px;">${esc(title)}</div>
<div style="font-size:15px;line-height:1.55;color:#1A1917;margin-bottom:16px;">${esc(opts.body)}</div>
<div style="font-size:14px;line-height:1.55;color:#4D4B45;margin-bottom:20px;">${esc(copy.why)}</div>
<a href="${esc(open)}" style="display:inline-block;background:#14513F;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px;">${esc(copy.cta)}</a>
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.6;color:#65635C;">
You're getting this because email is on for ${esc(copy.settingName)} in Tally.<br>
<a href="${esc(manage)}" style="color:#65635C;">Change alert settings</a> · <a href="${esc(unsub)}" style="color:#65635C;">Turn off all alert emails</a>
</td></tr></table></td></tr></table></body></html>`;
}

/** Tally Pop's badge per alert type: background, text, the glyph that carries the meaning beside the color. */
const POP_BADGE: Record<AlertType, { bg: string; fg: string; glyph: string }> = {
  budget_threshold: { bg: "#FFC53D", fg: "#1D1B2F", glyph: "&#9650;" },
  connection_broken: { bg: "#D03B3B", fg: "#FFFFFF", glyph: "&#10005;" },
  large_transaction: { bg: "#E6E0FF", fg: "#1D1B2F", glyph: "&#9679;" },
  subscription_change: { bg: "#E6E0FF", fg: "#1D1B2F", glyph: "&#8635;" },
  goal_off_track: { bg: "#FFC53D", fg: "#1D1B2F", glyph: "&#9650;" },
  safe_to_spend_low: { bg: "#FFC53D", fg: "#1D1B2F", glyph: "&#9660;" },
};

const POP_FONT = "Figtree,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const POP_DISPLAY = "'Bricolage Grotesque',Figtree,-apple-system,Segoe UI,Helvetica,Arial,sans-serif";

/**
 * The same alert in the Tally Pop look, for users on it (users.ui_look,
 * lib/uiLook.ts): cream ground, an ink-outlined card whose thicker right
 * and bottom borders stand in for the hard shadow (box-shadow doesn't
 * survive Gmail or Outlook), a colored badge with a glyph, and a pill
 * button -- red for a broken connection, like the app's fix buttons.
 * Every text pair is AA. Same wording and footer as the classic email.
 */
function alertEmailHtmlPop(opts: { type: AlertType; title: string; body: string; url: string; appUrl: string; userId: string }): string {
  const copy = COPY[opts.type];
  const badge = POP_BADGE[opts.type];
  const open = `${opts.appUrl}${openLinkPath(opts.url)}`;
  const manage = `${opts.appUrl}/settings#alerts`;
  const unsub = `${opts.appUrl}/api/email/unsubscribe?uid=${opts.userId}&token=${unsubscribeToken(opts.userId)}&kind=alerts`;
  const cta = opts.type === "connection_broken" ? "#D03B3B" : "#5B3BF5";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Figtree:wght@400;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#FFF6E9;font-family:${POP_FONT};color:#1D1B2F;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(opts.body)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF6E9;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 18px;"><span style="display:inline-block;background:#5B3BF5;color:#FFFFFF;border:2px solid #1D1B2F;border-radius:12px;padding:3px 12px;font-family:${POP_DISPLAY};font-size:20px;font-weight:800;letter-spacing:-0.5px;">tally</span></td></tr>
<tr><td style="background:#FFFFFF;border:2px solid #1D1B2F;border-right-width:6px;border-bottom-width:6px;border-radius:24px;padding:28px;">
<div style="margin-bottom:14px;"><span style="display:inline-block;background:${badge.bg};color:${badge.fg};border:2px solid #1D1B2F;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">${badge.glyph} ${esc(copy.label)}</span></div>
<div style="font-family:${POP_DISPLAY};font-size:30px;font-weight:800;line-height:1.1;letter-spacing:-0.8px;margin-bottom:12px;">${esc(opts.title)}</div>
<div style="font-size:16px;line-height:1.55;color:#1D1B2F;margin-bottom:16px;">${esc(opts.body)}</div>
<div style="font-size:14px;line-height:1.55;color:#4A4760;margin-bottom:22px;">${esc(copy.why)}</div>
<a href="${esc(open)}" style="display:inline-block;background:${cta};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:800;padding:12px 24px;border:2px solid #1D1B2F;border-right-width:4px;border-bottom-width:4px;border-radius:999px;">${esc(copy.cta)}</a>
</td></tr>
<tr><td style="padding:18px 4px;font-size:12.5px;line-height:1.6;color:#4A4760;">
You're getting this because email is on for ${esc(copy.settingName)} in Tally.<br>
<a href="${esc(manage)}" style="color:#4A4760;">Change alert settings</a> · <a href="${esc(unsub)}" style="color:#4A4760;">Turn off all alert emails</a>
</td></tr></table></td></tr></table></body></html>`;
}
