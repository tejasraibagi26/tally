import type { AlertType } from "@tally/core/alerts";
import { unsubscribeToken } from "@/lib/emailUnsubscribe";

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
export function alertEmailHtml(opts: { type: AlertType; title: string; body: string; url: string; appUrl: string; userId: string }): string {
  const copy = COPY[opts.type];
  const title = opts.title;
  const open = `${opts.appUrl}${opts.url}`;
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
