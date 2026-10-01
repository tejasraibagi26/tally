import { unsubscribeToken } from "@/lib/emailUnsubscribe";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * One alert as an email (ALERTS.md §5.2). Deliberately small: light v2
 * palette, inline styles only (email clients), one action, and a footer
 * with "Manage alerts" plus a one-click unsubscribe that turns off alert
 * email only -- recaps keep their own switch.
 */
export function alertEmailHtml(opts: { title: string; body: string; url: string; appUrl: string; userId: string }): string {
  const open = `${opts.appUrl}${opts.url}`;
  const manage = `${opts.appUrl}/settings#alerts`;
  const unsub = `${opts.appUrl}/api/email/unsubscribe?uid=${opts.userId}&token=${unsubscribeToken(opts.userId)}&kind=alerts`;
  return `<!doctype html><html><body style="margin:0;background:#F1F0EC;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1917;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F0EC;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 4px 16px;font-family:Georgia,serif;font-size:22px;color:#1A1917;">Tally</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E3E1DB;border-radius:12px;padding:24px;">
<div style="font-size:18px;font-weight:600;line-height:1.35;margin-bottom:8px;">${esc(opts.title)}</div>
<div style="font-size:15px;line-height:1.55;color:#4D4B45;margin-bottom:20px;">${esc(opts.body)}</div>
<a href="${esc(open)}" style="display:inline-block;background:#14513F;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px;">Open in Tally</a>
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#65635C;">
You're getting this because this alert is turned on for email.
<a href="${esc(manage)}" style="color:#65635C;">Manage alerts</a> · <a href="${esc(unsub)}" style="color:#65635C;">Stop alert emails</a>
</td></tr></table></td></tr></table></body></html>`;
}
