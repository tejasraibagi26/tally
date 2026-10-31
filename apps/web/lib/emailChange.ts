import { SignJWT, jwtVerify } from "jose";
import { sendEmail } from "./emailService";

/**
 * Changing the login email goes through the new address: the account form
 * only sends a link there, and the email changes when that link is used
 * (app/api/account/email/confirm). The link is a short-lived JWT naming the
 * user, the address it moves *from* and the one it moves *to* -- so it's
 * dead once the email has changed by any route, and nothing is stored.
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

const shell = (body: string) =>
  `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F1F0EC;color:#1A1917;padding:32px">` +
  `<div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:480px;margin:0 auto">${body}</div></body></html>`;

/** Sends the confirm link to the new address and a heads-up to the old one. */
export async function sendEmailChangeEmails(opts: { appUrl: string; userId: string; fromEmail: string; toEmail: string }): Promise<void> {
  const token = await emailChangeToken(opts.userId, opts.fromEmail, opts.toEmail);
  const link = `${opts.appUrl}/api/account/email/confirm?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: opts.toEmail,
    subject: "Confirm your new Tally email",
    html: shell(
      `<p>Someone asked to make <strong>${esc(opts.toEmail)}</strong> the sign-in email for a Tally account.</p>` +
        `<p><a href="${esc(link)}" style="display:inline-block;padding:10px 20px;background:#1A1917;color:#fff;border-radius:8px;text-decoration:none">Confirm new email</a></p>` +
        `<p style="color:#6B6A66;font-size:13px">The link works for an hour. If this wasn't you, ignore this email and nothing changes.</p>`,
    ),
  });

  await sendEmail({
    to: opts.fromEmail,
    subject: "Your Tally email is being changed",
    html: shell(
      `<p>Someone asked to change your Tally sign-in email to <strong>${esc(opts.toEmail)}</strong>.</p>` +
        `<p>It only changes if that address confirms. If this wasn't you, change your password now — that signs out every device.</p>`,
    ),
  });
}
