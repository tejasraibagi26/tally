import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DocsNav, type DocsNavItem } from "@/components/docs/DocsNav";

// Read the repo's LICENSE file directly rather than duplicating its text here, so there is one source of truth.
function readLicenseText(): string {
  return readFileSync(join(process.cwd(), "LICENSE"), "utf-8");
}

const NAV: DocsNavItem[] = [
  { id: "requirements", label: "Requirements" },
  {
    id: "quick-start",
    label: "Quick start",
    children: [
      { id: "quick-start-postgres", label: "Start Postgres" },
      { id: "quick-start-env", label: "Configure environment" },
      { id: "quick-start-install", label: "Install, migrate, seed" },
      { id: "quick-start-run", label: "Run the app" },
      { id: "quick-start-worker", label: "Run the worker" },
    ],
  },
  { id: "environment", label: "Environment variables" },
  {
    id: "mock-mode",
    label: "Mock mode vs. live Plaid",
    children: [
      { id: "mock-mode-how", label: "How mock mode works" },
      { id: "mock-mode-live", label: "Switching to Sandbox" },
    ],
  },
  { id: "worker", label: "Running the worker" },
  {
    id: "production",
    label: "Deploying to production",
    children: [
      { id: "production-plaid", label: "Plaid production access" },
      { id: "production-env", label: "Environment differences" },
      { id: "production-process", label: "Running the app and worker" },
      { id: "production-security", label: "Transport and secrets" },
    ],
  },
  { id: "backups", label: "Backups" },
  { id: "secret-rotation", label: "Secret rotation" },
  { id: "license", label: "License" },
];

const ENV_VARS: { name: string; required: boolean; description: string }[] = [
  { name: "DATABASE_URL", required: true, description: "Postgres connection string." },
  { name: "AUTH_SECRET", required: true, description: "Session signing secret. Generate with npx auth secret." },
  { name: "APP_URL", required: true, description: "The public URL this instance is reachable at. Must be an HTTPS origin in production." },
  { name: "MOCK_DATA", required: false, description: "true forces mock mode, false forces live Plaid. Unset: development defaults to mock, production defaults to live." },
  { name: "PLAID_CLIENT_ID", required: false, description: "From the Plaid dashboard. Only needed once mock mode is disabled." },
  { name: "PLAID_SECRET", required: false, description: "From the Plaid dashboard, matching PLAID_ENV." },
  { name: "PLAID_ENV", required: false, description: "sandbox or production." },
  { name: "PLAID_PRODUCTS", required: false, description: "Comma-separated, defaults to transactions. Actively requested at Link time; each is billed once an item connects." },
  { name: "PLAID_ADDITIONAL_CONSENTED_PRODUCTS", required: false, description: "Comma-separated, defaults to investments,liabilities. Consented during Link but billed only once actually fetched." },
  { name: "PLAID_COUNTRY_CODES", required: false, description: "Comma-separated, defaults to US." },
  { name: "PLAID_REDIRECT_URI", required: false, description: "Required for OAuth institutions. Must be registered in the Plaid dashboard first, separately per environment." },
  { name: "PLAID_WEBHOOK_URL", required: false, description: "Where Plaid pushes sync events. Requires a public HTTPS URL (a tunnel in local development)." },
  { name: "MASTER_KEY", required: true, description: "32-byte base64 key. Generate with openssl rand -base64 32. Encrypts Plaid access tokens at rest." },
  { name: "CRON_TZ", required: false, description: "Timezone for the worker's cron schedules. Defaults to America/New_York." },
  { name: "ADMIN_EMAIL", required: true, description: "Used once by npm run seed:user to create the single admin login." },
  { name: "ADMIN_PASSWORD", required: true, description: "Used once by npm run seed:user. At least 8 characters." },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-surface-2 border border-border rounded-control p-4 overflow-x-auto text-[13px] font-mono text-text leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 pt-2 scroll-mt-24">
      <h2 className="font-display text-2xl text-text">{title}</h2>
      <div className="flex flex-col gap-4 text-[15px] text-text-2 leading-relaxed">{children}</div>
    </section>
  );
}

function Subsection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="flex flex-col gap-3 pt-1 scroll-mt-24">
      <h3 className="text-[17px] font-semibold text-text">{title}</h3>
      <div className="flex flex-col gap-3 text-[15px] text-text-2 leading-relaxed">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  const licenseText = readLicenseText();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="max-w-[1120px] mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-[8px] bg-brand text-on-brand flex items-center justify-center font-display text-base leading-none">T</span>
          <span className="font-display text-xl text-text">Tally</span>
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="h-9 px-4 inline-flex items-center rounded-control bg-brand text-on-brand text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-[1120px] mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12">
        <aside className="hidden lg:block">
          <DocsNav items={NAV} />
        </aside>

        <div className="flex flex-col gap-14">
          <div className="flex flex-col gap-4 pt-4">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-brand">Self-hosting guide</span>
            <h1 className="font-display text-[44px] leading-[1.1] text-text">Run your own copy of Tally</h1>
            <p className="text-[17px] text-text-2 max-w-2xl leading-relaxed">
              Tally is source-available under the{" "}
              <Link href="/docs#license" className="text-brand hover:underline">
                Functional Source License
              </Link>
              . You provide your own Postgres database and Plaid account, and the application runs entirely on
              infrastructure you control. A working Sandbox instance takes about ten minutes to bring up from a fresh
              clone.
            </p>
          </div>

          <Section id="requirements" title="Requirements">
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>Node.js 20 or later, and npm</li>
              <li>PostgreSQL 16, provisioned through the included Docker Compose file or an existing local install</li>
              <li>
                A free <span className="text-text">Plaid Sandbox account</span>, required only once mock mode is
                disabled. The application runs with zero Plaid credentials in development by default
              </li>
              <li>Optional: a tunnel tool such as ngrok or cloudflared, needed only to test OAuth institutions or live webhooks against a local server</li>
            </ul>
          </Section>

          <Section id="quick-start" title="Quick start">
            <Subsection id="quick-start-postgres" title="Start Postgres">
              <CodeBlock>{`docker compose up -d`}</CodeBlock>
              <p>
                This provisions Postgres only. If a Postgres instance is already available, skip this step and point{" "}
                <span className="font-mono text-text">DATABASE_URL</span> at it directly.
              </p>
            </Subsection>

            <Subsection id="quick-start-env" title="Configure environment">
              <CodeBlock>{`cp .env.example .env`}</CodeBlock>
              <p>
                Set <span className="font-mono text-text">AUTH_SECRET</span> (<span className="font-mono text-text">npx auth secret</span>) and{" "}
                <span className="font-mono text-text">MASTER_KEY</span> (<span className="font-mono text-text">openssl rand -base64 32</span>). Leave every{" "}
                <span className="font-mono text-text">PLAID_*</span> variable blank for now, mock mode does not require them.
              </p>
            </Subsection>

            <Subsection id="quick-start-install" title="Install, migrate, seed">
              <p>Install dependencies, run migrations, and seed an admin user plus the category taxonomy:</p>
              <CodeBlock>{`npm install
npm run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-password-here npm run seed:user
npm run seed:categories`}</CodeBlock>
            </Subsection>

            <Subsection id="quick-start-run" title="Run the app">
              <CodeBlock>{`npm run dev`}</CodeBlock>
              <p>
                Visit <span className="font-mono text-text">http://localhost:3000</span> and sign in. Mock data is
                enabled by default in development: "Add account" connects a fixture institution with realistic
                accounts and transactions immediately, with no Plaid credentials required.
              </p>
            </Subsection>

            <Subsection id="quick-start-worker" title="Run the worker">
              <p>In a second terminal, start the background worker:</p>
              <CodeBlock>{`npm run worker`}</CodeBlock>
              <p>
                This is required for automatic, scheduled sync. The app's own "Sync now" action calls the sync engine
                directly and works without the worker running.
              </p>
            </Subsection>
          </Section>

          <Section id="environment" title="Environment variables">
            <p>Every variable the application reads, and which of them are required for it to start at all.</p>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-[13.5px] border-collapse">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="px-2 py-2 font-medium text-text-3 uppercase text-xs tracking-wide">Variable</th>
                    <th className="px-2 py-2 font-medium text-text-3 uppercase text-xs tracking-wide">Required</th>
                    <th className="px-2 py-2 font-medium text-text-3 uppercase text-xs tracking-wide">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {ENV_VARS.map((v) => (
                    <tr key={v.name} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-2.5 font-mono text-text whitespace-nowrap align-top">{v.name}</td>
                      <td className="px-2 py-2.5 align-top">
                        {v.required ? <span className="text-negative">Yes</span> : <span className="text-text-3">Optional</span>}
                      </td>
                      <td className="px-2 py-2.5 text-text-2 align-top">{v.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="mock-mode" title="Mock mode vs. live Plaid">
            <Subsection id="mock-mode-how" title="How mock mode works">
              <p>
                Mock mode resolves as follows: if <span className="font-mono text-text">MOCK_DATA</span> is set, its
                value wins outright. If it is unset, development defaults to mock and production defaults to live.
              </p>
              <p>
                In mock mode, "Add account" inserts a canned institution, with checking, savings, credit, and
                brokerage accounts, directly into Postgres. No network calls are made. Every downstream feature reads
                the same database rows a live connection would produce, so it exercises the same code paths.
              </p>
            </Subsection>

            <Subsection id="mock-mode-live" title="Switching to Sandbox">
              <ol className="list-decimal pl-5 flex flex-col gap-1.5">
                <li>
                  Get Sandbox credentials from the{" "}
                  <a href="https://dashboard.plaid.com" className="text-brand hover:underline" target="_blank" rel="noreferrer">
                    Plaid dashboard
                  </a>
                  .
                </li>
                <li>
                  Set <span className="font-mono text-text">PLAID_CLIENT_ID</span>, <span className="font-mono text-text">PLAID_SECRET</span>, and{" "}
                  <span className="font-mono text-text">PLAID_ENV=sandbox</span> in <span className="font-mono text-text">.env</span>.
                </li>
                <li>
                  Set <span className="font-mono text-text">MOCK_DATA=false</span>.
                </li>
                <li>
                  For OAuth institutions and webhooks, tunnel the local server and set{" "}
                  <span className="font-mono text-text">PLAID_REDIRECT_URI</span> and{" "}
                  <span className="font-mono text-text">PLAID_WEBHOOK_URL</span> to the tunnel URL. Register the
                  redirect URI in the Plaid dashboard before using it; Plaid rejects Link entirely for an
                  unregistered URI.
                </li>
                <li>
                  Sandbox login: <span className="font-mono text-text">user_good</span> /{" "}
                  <span className="font-mono text-text">pass_good</span> (MFA: <span className="font-mono text-text">mfa_device</span>).
                </li>
              </ol>
            </Subsection>
          </Section>

          <Section id="worker" title="Running the worker">
            <p>
              <span className="font-mono text-text">npm run worker</span> processes webhook-triggered and
              cron-scheduled syncs against the same database as the application. It is a separate, long-running
              process, not a request handler, and must be kept running continuously rather than invoked on demand.
            </p>
            <p>
              If it stops, nothing syncs automatically. The application's manual "Sync now" action is unaffected,
              since it calls the sync engine directly rather than enqueuing a job.
            </p>
          </Section>

          <Section id="production" title="Deploying to production">
            <p>
              Everything above describes a local instance running against Plaid Sandbox with mock data available as a
              fallback. Serving real accounts requires four additional decisions: Plaid access, environment
              configuration, process management, and transport security.
            </p>

            <Subsection id="production-plaid" title="Plaid production access">
              <p>
                Plaid does not allow Sandbox credentials to read real accounts. Production access requires an
                approved application in the Plaid dashboard and is billed per connected item and product; Transactions
                and Investments are priced separately. Confirm current pricing before connecting real accounts.
              </p>
              <p>
                Approval issues a second, distinct <span className="font-mono text-text">PLAID_CLIENT_ID</span> /{" "}
                <span className="font-mono text-text">PLAID_SECRET</span> pair, unrelated to the Sandbox pair already
                in use. A separate redirect URI must also be registered under the production application; Sandbox
                registrations do not carry over.
              </p>
            </Subsection>

            <Subsection id="production-env" title="Environment differences">
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>
                  Set <span className="font-mono text-text">PLAID_ENV=production</span> and the production{" "}
                  <span className="font-mono text-text">PLAID_CLIENT_ID</span> / <span className="font-mono text-text">PLAID_SECRET</span>{" "}
                  pair. <span className="font-mono text-text">MOCK_DATA</span> does not need to be set explicitly: with{" "}
                  <span className="font-mono text-text">NODE_ENV=production</span>, the application already defaults
                  to live mode. Set <span className="font-mono text-text">MOCK_DATA=true</span> only if a production
                  build is being run in a staging capacity without real Plaid access.
                </li>
                <li>
                  Set <span className="font-mono text-text">APP_URL</span> to the instance's real, public HTTPS
                  origin, not a local or tunnel address.
                </li>
                <li>
                  Set <span className="font-mono text-text">PLAID_REDIRECT_URI</span> and{" "}
                  <span className="font-mono text-text">PLAID_WEBHOOK_URL</span> to paths under that same origin. No
                  tunnel is needed in production, since the origin is already public; both values still need to be
                  registered in the Plaid dashboard under the production application before use.
                </li>
              </ul>
            </Subsection>

            <Subsection id="production-process" title="Running the app and worker">
              <p>
                The application (<span className="font-mono text-text">npm run build</span> then{" "}
                <span className="font-mono text-text">npm run start</span>) and the worker (
                <span className="font-mono text-text">npm run worker</span>) are two independent, long-running
                processes. Both must stay running continuously; a stopped worker fails silently, since manual sync
                keeps working while scheduled and webhook-triggered sync simply stop.
              </p>
              <p>
                The <span className="font-mono text-text">docker-compose.yml</span> included in this repository
                provisions Postgres only. Running the application and worker in containers means adding service
                definitions for them; running them directly on a host means supervising both with a process manager
                (systemd, pm2, or equivalent) configured to restart on failure and capture logs. A serverless request
                handler is not a substitute for the worker: it has no facility for a persistent job-queue listener,
                so a platform that runs the application as serverless functions still needs the worker hosted
                separately as a standing process.
              </p>
            </Subsection>

            <Subsection id="production-security" title="Transport and secrets">
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>
                  HTTPS is a requirement, not an option: Plaid rejects non-HTTPS redirect and webhook URLs in
                  production. Terminate TLS at a reverse proxy or the platform's load balancer, and enable HSTS there.
                </li>
                <li>
                  Do not commit <span className="font-mono text-text">.env</span> or pass secrets on the command
                  line. Use the platform's environment configuration or secret store for{" "}
                  <span className="font-mono text-text">DATABASE_URL</span>, <span className="font-mono text-text">AUTH_SECRET</span>,{" "}
                  <span className="font-mono text-text">MASTER_KEY</span>, and <span className="font-mono text-text">PLAID_SECRET</span>.
                </li>
                <li>
                  <span className="font-mono text-text">MASTER_KEY</span> decrypts every stored Plaid access token.
                  Losing it is equivalent to losing every connected account. Back it up with at least the rigor
                  applied to the database itself, and store that backup somewhere other than the application host.
                </li>
              </ul>
            </Subsection>
          </Section>

          <Section id="backups" title="Backups">
            <p>
              A running instance holds a complete transaction history for every connected account. Back up Postgres
              on a fixed schedule, encrypt the backup files at rest, and store them somewhere other than the database
              host.
            </p>
            <CodeBlock>{`# Backup
pg_dump "$DATABASE_URL" -Fc -f tally-$(date +%Y%m%d).dump

# Restore into a fresh database
pg_restore -d "$DATABASE_URL" --clean --if-exists tally-20260101.dump`}</CodeBlock>
            <p>
              A cron job invoking the <span className="font-mono text-text">pg_dump</span> command above on a
              schedule is sufficient at this scale. Restore from a backup periodically to confirm it is valid; an
              untested backup is not a verified one.
            </p>
          </Section>

          <Section id="secret-rotation" title="Secret rotation">
            <p>
              <span className="font-mono text-text">PLAID_SECRET</span>: generate a replacement in the Plaid
              dashboard, update <span className="font-mono text-text">.env</span>, restart the application and
              worker, and confirm a sync still succeeds before revoking the previous secret. Plaid secrets are never
              stored in the database, only transmitted to Plaid's API, so no data migration is required.
            </p>
            <p>
              <span className="font-mono text-text">MASTER_KEY</span>: this key is what every stored access token is
              encrypted under, so rotating it requires re-encrypting each one. Stop the application and worker,
              generate a new key, then run:
            </p>
            <CodeBlock>{`OLD_MASTER_KEY=<current key> NEW_MASTER_KEY=<new key> npm run rotate:master-key`}</CodeBlock>
            <p>
              Set <span className="font-mono text-text">MASTER_KEY</span> to the new value and restart. Do not
              discard the old key until the rotation script has completed successfully.
            </p>
          </Section>

          <Section id="license" title="License">
            <p>
              Tally is available under the Functional Source License 1.1, Apache 2.0 Future Grant (FSL-1.1-ALv2). It
              may be self-hosted, modified, and used for any purpose other than offering it, or a substantially
              similar service, to others commercially. Each release converts to Apache 2.0 automatically two years
              after publication.
            </p>
            <pre className="bg-surface-2 border border-border rounded-control p-4 overflow-x-auto text-[12.5px] font-mono text-text-2 leading-relaxed max-h-[400px] overflow-y-auto whitespace-pre-wrap">
              {licenseText}
            </pre>
          </Section>
        </div>
      </div>
    </div>
  );
}
