/**
 * Sender for Uplift Send (send.useuplift.live), the user's own in-progress
 * email-sending service — not a third-party ESP. Generic on purpose: any
 * feature that needs to send an email calls this, not just the monthly recap.
 */
import { log } from "@switchyard/logger";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const baseUrl = process.env.EMAIL_SERVICE_URL;
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("EMAIL_SERVICE_URL/EMAIL_SERVICE_API_KEY not configured");
  }

  const started = Date.now();
  // Only the domain is logged, never the full address.
  const toDomain = to.split("@")[1] ?? "unknown";
  const res = await fetch(`${baseUrl}/api/v1/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Carries the current transaction to the email service, so both sides show up as one flow.
      ...log.inject({}),
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    log.error("email send failed", { toDomain, subject, status: res.status, durationMs: Date.now() - started, response: body.slice(0, 500) });
    throw new Error(`Email send failed (${res.status}): ${body}`);
  }
  log.info("email sent", { toDomain, subject, durationMs: Date.now() - started });
}
