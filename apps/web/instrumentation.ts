/** Reports any error a route throws (logs go to the console, i.e. Vercel's runtime logs). */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("./lib/log");
  log.error(err instanceof Error ? err : new Error(String(err)), {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    uncaught: true,
  });
}
