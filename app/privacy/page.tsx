import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoMark } from "@/components/Logo";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 pt-2">
      <h2 className="font-display text-2xl text-text">{title}</h2>
      <div className="flex flex-col gap-4 text-[15px] text-text-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="max-w-[760px] mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-display text-xl text-text">Tally</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm font-medium text-text-2 hover:text-text transition-colors">
            Docs
          </Link>
          <ThemeToggle />
          <Link
            href="/login"
            className="h-9 px-4 inline-flex items-center rounded-control bg-brand text-on-brand text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-[760px] mx-auto px-6 pb-24 flex flex-col gap-14">
        <div className="flex flex-col gap-4 pt-4">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-brand">Privacy policy</span>
          <h1 className="font-display text-[40px] leading-[1.1] text-text">How Tally handles your data</h1>
          <p className="text-[17px] text-text-2 max-w-2xl leading-relaxed">
            Tally is source-available software that each operator runs on their own infrastructure and their own
            database. This document describes what a running instance stores and does with data by default, based on
            how the software is actually built. It is not a substitute for a policy specific to any given deployment.
          </p>
        </div>

        <Section title="Who this policy describes">
          <p>
            Tally has no central service and no shared database across installations. Every instance is operated
            independently by whoever deployed it, on infrastructure and a database they control. That operator, not
            the authors of this software, is the party responsible for the data an instance stores.
          </p>
          <p>
            If you are using an instance someone else operates, the operator of that instance is who this policy
            should identify. Operators publishing their own policy should replace the placeholders below with their
            own contact details and fill in anything specific to how they run their deployment.
          </p>
          <div className="bg-surface-2 border border-border rounded-control p-4 text-[14px] text-text-2">
            Operated by: <span className="font-mono text-text">[OPERATOR NAME]</span>
            <br />
            Contact: <span className="font-mono text-text">[OPERATOR CONTACT EMAIL]</span>
          </div>
        </Section>

        <Section title="Information stored">
          <p>An instance stores, in its own Postgres database, only what's needed to run the application:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Your account email and a bcrypt hash of your password. The password itself is never stored.</li>
            <li>
              Data from any financial institution you connect through Plaid: account and balance information,
              transactions, investment holdings, and credit liabilities, exactly as Plaid returns them.
            </li>
            <li>Data you create directly: budgets, categorization rules, and category assignments.</li>
            <li>
              An encrypted Plaid access token per connected institution, used to fetch the data above. It is never
              exposed by any API response.
            </li>
          </ul>
        </Section>

        <Section title="How your data is used">
          <p>
            Data is used only to render the application's own features for your account: net worth, transaction
            history, budgets, recurring-payment detection, and investment and liability views. Every query is scoped
            to the signed-in user. There is no cross-account aggregation, no advertising, and no resale of data to
            any third party.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            Connecting a financial institution is handled by{" "}
            <a href="https://plaid.com/legal/" className="text-brand hover:underline" target="_blank" rel="noreferrer">
              Plaid
            </a>
            , which is necessary to retrieve data from your bank, card issuer, or brokerage. Plaid's own privacy
            policy governs what Plaid itself collects and how it's used; connecting an account means you're also
            subject to Plaid's terms for that connection.
          </p>
          <p>
            Beyond Plaid, the application makes no calls to third-party analytics, tracking, or advertising services,
            and sends no financial data to a third-party AI or LLM provider.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Passwords are hashed with bcrypt and never stored or logged in plaintext. Each Plaid access token is
            encrypted at rest with AES-256-GCM under a key the operator controls (<span className="font-mono text-text">MASTER_KEY</span>) and is
            decrypted only at the moment it's needed to call Plaid's API.
          </p>
          <p>
            Beyond that, security depends on how an operator runs their instance: whether the database and backups
            are encrypted, whether the deployment is served over HTTPS, and how access to the underlying
            infrastructure is controlled. None of that is enforced by the application itself.
          </p>
        </Section>

        <Section title="Cookies and sessions">
          <p>
            Signing in sets a single session cookie containing a signed JSON Web Token, used only to keep you signed
            in. No tracking, advertising, or third-party cookies are set by the application.
          </p>
        </Section>

        <Section title="Data retention and deletion">
          <p>
            Data persists until it is explicitly deleted. Disconnecting a financial institution removes that
            institution's access token and all of its locally stored accounts, transactions, and holdings.
          </p>
          <p>
            The account settings page also offers a full data wipe, which disconnects every connected institution and
            deletes all financial data for your account. It does not delete the account login itself; removing that
            requires direct access to the database, since the application doesn't expose that action in its own UI.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can disconnect any institution or wipe your account's financial data at any time from Settings.
            Because each instance is self-hosted, requests beyond what the application exposes directly (such as
            deleting the account login itself) should go to the operator identified above.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            This document describes the software's default behavior as of the version an instance is running. An
            operator who modifies the application, adds integrations, or changes how data is handled should update
            this page to match, since it stops being accurate the moment the software's actual behavior changes.
          </p>
        </Section>
      </div>
    </div>
  );
}
