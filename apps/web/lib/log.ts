import { AsyncLocalStorage } from "node:async_hooks";
import { after } from "next/server";
import { log as base } from "@switchyard/logger";

/**
 * Who a request came from, attached to every log written while handling it
 * (route() below sets it up). `client` answers "web or mobile?":
 *
 *   mobile  the app (sends x-tally-client: mobile, plus its version/platform;
 *           older builds are known by their non-API-key bearer token)
 *   web     the browser app (same-origin fetch or page)
 *   api     a personal API key (Bearer tly_…: Shortcuts, scripts)
 *   plaid   Plaid's webhook
 *   cron    Vercel cron
 *   unknown anything else
 *
 * userId and requestId are lifted by Switchyard into their own top-level
 * fields; the rest lands in the event's context.
 */
export type RequestLogContext = {
  client: "mobile" | "web" | "api" | "plaid" | "cron" | "unknown";
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  appVersion?: string;
  buildSha?: string;
  updateId?: string;
  platform?: string;
  osVersion?: string;
  device?: string;
  timezone?: string;
  country?: string;
  userAgent?: string;
};

const store = new AsyncLocalStorage<RequestLogContext>();

function header(req: Request, name: string, max = 80): string | undefined {
  const v = req.headers.get(name)?.trim();
  return v ? v.slice(0, max) : undefined;
}

function clientOf(req: Request, path: string): RequestLogContext["client"] {
  const declared = header(req, "x-tally-client");
  if (declared === "mobile" || declared === "web") return declared;
  if (path.startsWith("/api/cron/")) return "cron";
  if (path === "/api/plaid/webhook") return "plaid";
  // Personal API keys (lib/apiKeyAuth.ts) start tly_; every other bearer
  // token is the app's access token -- so an app build from before it sent
  // x-tally-client still reads as mobile (just without its version fields).
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer tly_")) return "api";
  if (auth?.startsWith("Bearer ")) return "mobile";
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none" || req.headers.get("cookie")?.includes("authjs.")) return "web";
  return "unknown";
}

/** Exported for tests: the context route() attaches for a request. */
export function requestLogContext(req: Request): RequestLogContext {
  let path = "/";
  try {
    path = new URL(req.url).pathname;
  } catch {}
  const client = clientOf(req, path);
  const ctx: RequestLogContext = {
    client,
    // Vercel's id for this request: find it in the Vercel dashboard too.
    requestId: header(req, "x-vercel-id", 120),
    method: req.method,
    path,
    country: header(req, "x-vercel-ip-country", 8),
    timezone: header(req, "x-tally-timezone", 64),
  };
  if (client === "mobile") {
    Object.assign(ctx, {
      appVersion: header(req, "x-tally-app-version", 20),
      buildSha: header(req, "x-tally-build", 20),
      updateId: header(req, "x-tally-update-id", 64),
      platform: header(req, "x-tally-platform", 20),
      osVersion: header(req, "x-tally-os-version", 20),
      device: header(req, "x-tally-device", 60),
    });
    // An older build that didn't send its headers: the user agent is all there is.
    if (!ctx.appVersion) ctx.userAgent = header(req, "user-agent", 200);
  } else if (client === "web" || client === "api" || client === "unknown") {
    ctx.userAgent = header(req, "user-agent", 200);
  }
  // Drop the empty ones so a log's context stays short.
  for (const k of Object.keys(ctx) as (keyof RequestLogContext)[]) if (ctx[k] === undefined) delete ctx[k];
  return ctx;
}

/** Records the signed-in user on the current request's logs (requireUserId calls it). */
export function setLogUser(userId: string): void {
  const ctx = store.getStore();
  if (ctx) ctx.userId = userId;
}

/** The current request's log context, if any. */
export function currentLogContext(): RequestLogContext | undefined {
  return store.getStore();
}

// Merges the request context under whatever the call passed, keeping the
// logger's own conventions: an Error as ctx becomes `err` (Switchyard lifts
// it into the event's error), anything else that isn't an object `detail`.
function withRequest(ctx: unknown): unknown {
  const req = store.getStore();
  if (!req) return ctx;
  if (ctx === undefined || ctx === null) return { ...req };
  if (ctx instanceof Error) return { ...req, err: ctx };
  if (Array.isArray(ctx)) return { ...req, items: ctx };
  if (typeof ctx === "object") return { ...req, ...(ctx as Record<string, unknown>) };
  return { ...req, detail: ctx };
}

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
const at = (level: Level) => (msg: unknown, ctx?: unknown) => base[level](msg, withRequest(ctx));

/** The app's logger: Switchyard's, plus the request context on every line. */
export const log = {
  trace: at("trace"),
  debug: at("debug"),
  info: at("info"),
  warn: at("warn"),
  error: at("error"),
  fatal: at("fatal"),
  child: base.child,
  flush: base.flush,
  inject: base.inject,
  extract: base.extract,
  withTransaction: base.withTransaction,
  currentTransaction: base.currentTransaction,
};

/**
 * Wraps an API route handler for Switchyard: continues the transaction from the caller (or starts one),
 * tags every log in the request with it and with who sent it (requestLogContext), logs one line per
 * request, and sends logs after the response.
 *
 *   async function GET_handler(req: Request) { … }
 *   export const GET = route(GET_handler);
 */
export function route<R extends Request, A extends unknown[]>(fn: (req: R, ...args: A) => Response | Promise<Response>) {
  return base.handler(
    (req: R, ...args: A) =>
      store.run(requestLogContext(req), async () => {
        const start = Date.now();
        let res: Response;
        try {
          res = await fn(req, ...args);
        } catch (err) {
          // Logged here (not left to Switchyard's handler) so the line carries
          // the client and user; the caller gets the same 500 either way.
          log.error(err instanceof Error ? err : new Error(String(err)), { uncaught: true });
          res = Response.json({ error: "Something went wrong" }, { status: 500 });
        }
        const durationMs = Date.now() - start;
        const ctx = store.getStore()!;
        log[res.status >= 500 ? "warn" : "info"](`${req.method} ${ctx.path} ${res.status} in ${durationMs}ms`, { status: res.status, durationMs });
        return res;
      }),
    { waitUntil: after },
  );
}
