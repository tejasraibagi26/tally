import { SignJWT, jwtVerify } from "jose";
import { sendEmail } from "./emailService";

/**
 * Changing the login email goes through the new address: the account form
 * only sends a link there, and the email changes when that link is used
 * (the app/email-change page, which posts to app/api/account/email/confirm).
 * The link is a short-lived JWT naming the user, the address it moves
 * *from* and the one it moves *to* -- so it's dead once the email has
 * changed by any route, and nothing is stored.
 */

const TTL_SECONDS = 60 * 60; // 1 hour
const AUDIENCE = "tally:email-change";

function key(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function emailChangeToken(userId: string, fromEmail: string, toEmail: string): Promise<string> {
  return new SignJWT({ from: fromEmail, to: toEmail })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key());
}

export async function verifyEmailChangeToken(token: string): Promise<{ userId: string; from: string; to: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUDIENCE, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.from !== "string" || typeof payload.to !== "string") return null;
    return { userId: payload.sub, from: payload.from, to: payload.to };
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One account email's content, laid out like the alert emails (lib/alerts/email.ts). */
interface AccountEmail {
  preheader: string;
  title: string;
  body: string; // HTML, already escaped
  why: string;
  cta: { label: string; href: string } | null;
  footer: string;
}

const LABEL = "Account security";

// The classic look: light v2 palette, same card and type scale as a classic
// alert email.
function classicHtml(e: AccountEmail): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F1F0EC;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1917;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F0EC;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 4px 16px;font-family:Georgia,serif;font-size:22px;color:#1A1917;">Tally</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E3E1DB;border-radius:12px;padding:24px;">
<div style="font-size:12px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:#65635C;margin-bottom:8px;">${LABEL}</div>
<div style="font-size:20px;font-weight:600;line-height:1.3;margin-bottom:6px;">${esc(e.title)}</div>
<div style="font-size:15px;line-height:1.55;color:#1A1917;margin-bottom:16px;">${e.body}</div>
<div style="font-size:14px;line-height:1.55;color:#4D4B45;${e.cta ? "margin-bottom:20px;" : ""}">${esc(e.why)}</div>
${e.cta ? `<a href="${esc(e.cta.href)}" style="display:inline-block;background:#14513F;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px;">${esc(e.cta.label)}</a>` : ""}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.6;color:#65635C;">${esc(e.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const POP_FONT = "Figtree,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const POP_DISPLAY = "'Bricolage Grotesque',Figtree,-apple-system,Segoe UI,Helvetica,Arial,sans-serif";

// Tally Pop: the alert emails' cream ground, ink-outlined card with the
// thick right/bottom edge for a shadow, a badge and a pill button. The
// badge is the connection alert's red-with-a-cross for the heads-up that
// something changed, lilac with a key for the link you asked for.
function popHtml(e: AccountEmail, badge: { bg: string; fg: string; glyph: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Figtree:wght@400;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#FFF6E9;font-family:${POP_FONT};color:#1D1B2F;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF6E9;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 18px;"><span style="display:inline-block;background:#5B3BF5;color:#FFFFFF;border:2px solid #1D1B2F;border-radius:12px;padding:3px 12px;font-family:${POP_DISPLAY};font-size:20px;font-weight:800;letter-spacing:-0.5px;">tally</span></td></tr>
<tr><td style="background:#FFFFFF;border:2px solid #1D1B2F;border-right-width:6px;border-bottom-width:6px;border-radius:24px;padding:28px;">
<div style="margin-bottom:14px;"><span style="display:inline-block;background:${badge.bg};color:${badge.fg};border:2px solid #1D1B2F;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">${badge.glyph} ${LABEL}</span></div>
<div style="font-family:${POP_DISPLAY};font-size:30px;font-weight:800;line-height:1.1;letter-spacing:-0.8px;margin-bottom:12px;">${esc(e.title)}</div>
<div style="font-size:16px;line-height:1.55;color:#1D1B2F;margin-bottom:16px;">${e.body}</div>
<div style="font-size:14px;line-height:1.55;color:#4A4760;${e.cta ? "margin-bottom:22px;" : ""}">${esc(e.why)}</div>
${e.cta ? `<a href="${esc(e.cta.href)}" style="display:inline-block;background:#5B3BF5;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:800;padding:12px 24px;border:2px solid #1D1B2F;border-right-width:4px;border-bottom-width:4px;border-radius:999px;">${esc(e.cta.label)}</a>` : ""}
</td></tr>
<tr><td style="padding:18px 4px;font-size:12.5px;line-height:1.6;color:#4A4760;">${esc(e.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const KEY_BADGE = { bg: "#E6E0FF", fg: "#1D1B2F", glyph: "&#9679;" };
const CHANGE_BADGE = { bg: "#D03B3B", fg: "#FFFFFF", glyph: "&#10005;" };

/** The link that makes the change, sent to the new address. */
export function emailChangeConfirmHtml(opts: { toEmail: string; link: string; pop: boolean }): string {
  const e: AccountEmail = {
    preheader: "Confirm this as your new Tally sign-in email.",
    title: "Confirm your new email",
    body: `Someone asked to make <strong>${esc(opts.toEmail)}</strong> the sign-in email for a Tally account. Confirm it and you'll sign in with this address from now on.`,
    why: "The link works for an hour. If this wasn't you, ignore this email and nothing changes.",
    cta: { label: "Confirm new email", href: opts.link },
    footer: "You're getting this because this address was entered as a new sign-in email in Tally.",
  };
  return opts.pop ? popHtml(e, KEY_BADGE) : classicHtml(e);
}

/** The heads-up to the old address: nothing to click, one thing to do if it wasn't them. */
export function emailChangeNoticeHtml(opts: { toEmail: string; pop: boolean }): string {
  const e: AccountEmail = {
    preheader: `Someone asked to change your Tally sign-in email to ${opts.toEmail}.`,
    title: "Your sign-in email is being changed",
    body: `Someone asked to change your Tally sign-in email to <strong>${esc(opts.toEmail)}</strong>. It only changes if that address confirms.`,
    why: "If this wasn't you, change your password now. That signs out every device, including whoever asked.",
    cta: null,
    footer: "You're getting this because it's the sign-in email on your Tally account. Account security emails can't be turned off.",
  };
  return opts.pop ? popHtml(e, CHANGE_BADGE) : classicHtml(e);
}

/** Sends the confirm link to the new address and a heads-up to the old one,
 * in the account's look (lib/uiLook.ts), like every other Tally email. */
export async function sendEmailChangeEmails(opts: { appUrl: string; userId: string; fromEmail: string; toEmail: string; pop: boolean }): Promise<void> {
  const token = await emailChangeToken(opts.userId, opts.fromEmail, opts.toEmail);
  const link = `${opts.appUrl}/email-change?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: opts.toEmail,
    subject: "Tally · Confirm your new email",
    html: emailChangeConfirmHtml({ toEmail: opts.toEmail, link, pop: opts.pop }),
  });

  await sendEmail({
    to: opts.fromEmail,
    subject: "Tally · Your sign-in email is being changed",
    html: emailChangeNoticeHtml({ toEmail: opts.toEmail, pop: opts.pop }),
  });
}
