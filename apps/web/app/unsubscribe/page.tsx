import type { Metadata } from "next";
import Link from "next/link";
import { verifyUnsubscribeToken } from "@/lib/emailUnsubscribe";
import { AccountNotice, NoticeText } from "@/components/AccountNotice";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Unsubscribe · Tally" };

/**
 * Where an email's unsubscribe link lands (CAN-SPAM). Public in
 * middleware.ts -- the signed token is the auth. Opening it only asks (mail
 * filters pre-fetch links); the button POSTs to /api/email/unsubscribe,
 * which turns the emails off and sends the browser back with ?status=done.
 * `kind=alerts` is the alert emails; otherwise the monthly recap.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ uid?: string; token?: string; kind?: string; status?: string }> }) {
  const { uid, token, kind, status } = await searchParams;
  const alerts = kind === "alerts";
  const what = alerts ? "alert emails" : "monthly recap emails";

  if (status === "done") {
    return (
      <AccountNotice title="You're unsubscribed">
        <NoticeText>
          {alerts
            ? "You won't get any more alert emails from Tally. Your monthly recap is unchanged."
            : "You won't get any more monthly recap emails from Tally."}
        </NoticeText>
        <Link href={alerts ? "/settings#alerts" : "/settings"} className="text-[14.5px] font-medium text-brand hover:underline">
          Change email settings
        </Link>
      </AccountNotice>
    );
  }

  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
    return (
      <AccountNotice title="This link doesn't work">
        <NoticeText>It may have been cut off by your email app. You can turn emails off from Settings instead.</NoticeText>
        <Link href="/settings" className="text-[14.5px] font-medium text-brand hover:underline">
          Go to Settings
        </Link>
      </AccountNotice>
    );
  }

  const action = `/api/email/unsubscribe?${new URLSearchParams({ uid, token, ...(alerts ? { kind: "alerts" } : {}) })}`;
  return (
    <AccountNotice title="Unsubscribe?">
      <NoticeText>Stop getting {what} from Tally? You can turn them back on any time in Settings.</NoticeText>
      <form method="post" action={action}>
        <Button type="submit" size="lg" className="w-full">
          Unsubscribe
        </Button>
      </form>
    </AccountNotice>
  );
}
