/**
 * Sender for Uplift Send (send.useuplift.live), the user's own in-progress
 * email-sending service — not a third-party ESP. Generic on purpose: any
 * feature that needs to send an email calls this, not just the monthly recap.
 */
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

  const res = await fetch(`${baseUrl}/api/v1/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${body}`);
  }
}
