import { after } from "next/server";
import { log } from "@switchyard/logger";

export { log };

/**
 * Wraps an API route handler for Switchyard: continues the transaction from the caller (or starts one),
 * tags every log in the request with it, logs one line per request, and sends logs after the response.
 *
 *   async function GET_handler(req: Request) { … }
 *   export const GET = route(GET_handler);
 */
export function route<R extends Request, A extends unknown[]>(fn: (req: R, ...args: A) => Response | Promise<Response>) {
  return log.handler(fn, { waitUntil: after, logRequests: true });
}
