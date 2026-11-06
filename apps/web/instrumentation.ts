/**
 * Starts the Switchyard logger when the Next.js server boots, and reports any error a route throws.
 * Without SWITCHYARD_KEY (e.g. local dev) logs only go to the console.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { init } = await import("@switchyard/logger");
  init({
    apiKey: process.env.SWITCHYARD_KEY ?? "",
    endpoint: process.env.SWITCHYARD_ENDPOINT ?? "https://api.switchyard.useuplift.live",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ? `tally@${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : undefined,
    // Next.js already reports crashes through onRequestError below.
    captureUncaught: false,
    redact: ["access_token", "public_token", "plaidAccessToken", "secret"],
  });
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("@switchyard/logger");
  log.error(err instanceof Error ? err : new Error(String(err)), {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    uncaught: true,
  });
  await log.flush();
}
