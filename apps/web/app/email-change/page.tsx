import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyEmailChangeToken } from "@/lib/emailChange";
import { AccountNotice, NoticeText } from "@/components/AccountNotice";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Confirm your new email · Tally" };

/**
 * Where the confirmation email's link lands (lib/emailChange.ts). Public in
 * middleware.ts: it's often opened on a phone that isn't signed in, and the
 * signed token is the auth. Opening it only asks -- mail filters pre-fetch
 * links -- and the button POSTs to /api/account/email/confirm, which makes
 * the change and sends the browser back here with ?status= for the result.
 */
export default async function EmailChangePage({ searchParams }: { searchParams: Promise<{ token?: string; status?: string }> }) {
  const { token, status } = await searchParams;
  const claims = token ? await verifyEmailChangeToken(token) : null;

  if (status === "done") {
    return (
      <AccountNotice title="Email changed">
        <NoticeText>
          {claims ? (
            <>
              Sign in with <strong className="text-text">{claims.to}</strong> from now on. Every device was signed out, so you&apos;ll sign in again
              on each.
            </>
          ) : (
            <>Sign in with your new email from now on. Every device was signed out, so you&apos;ll sign in again on each.</>
          )}
        </NoticeText>
        <Link href="/login" className="ui-btn ui-btn-primary inline-flex h-11 items-center justify-center rounded-control bg-brand px-4 text-[15px] font-medium text-on-brand hover:bg-brand-hover">
          Sign in
        </Link>
      </AccountNotice>
    );
  }

  if (status === "taken") {
    return (
      <AccountNotice title="That email is taken">
        <NoticeText>Another Tally account signed up with this address after you asked for the change. Your sign-in email hasn&apos;t changed.</NoticeText>
        <Link href="/settings" className="text-[14.5px] font-medium text-brand hover:underline">
          Choose a different email in Settings
        </Link>
      </AccountNotice>
    );
  }

  // Single use: once the email has moved (by this link or any other way),
  // the token's `from` no longer matches and the link is dead.
  const [user] = claims
    ? await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, claims.userId)).limit(1)
    : [];
  if (!token || !claims || !user || user.email !== claims.from) {
    return (
      <AccountNotice title="This link has expired">
        <NoticeText>Confirmation links work once, for an hour. To change your sign-in email, start again from Settings and use the newest email.</NoticeText>
        <Link href="/settings" className="text-[14.5px] font-medium text-brand hover:underline">
          Go to Settings
        </Link>
      </AccountNotice>
    );
  }

  return (
    <AccountNotice title="Confirm your new email" footer="If you didn't ask for this, close this page. Nothing changes until you confirm.">
      <NoticeText>
        Make <strong className="text-text">{claims.to}</strong> your Tally sign-in email? You&apos;ll be signed out everywhere and sign in again with it.
      </NoticeText>
      <form method="post" action={`/api/account/email/confirm?token=${encodeURIComponent(token)}`}>
        <Button type="submit" size="lg" className="w-full">
          Confirm new email
        </Button>
      </form>
    </AccountNotice>
  );
}
