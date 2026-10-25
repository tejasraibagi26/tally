"use client";

import { useEffect } from "react";
import { showToast } from "@/lib/toast";
import { DEMO_READ_ONLY_CODE, DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";

/**
 * Turns a blocked demo write into a toast, everywhere, from one place.
 *
 * Middleware refuses demo writes with a 403 (lib/auth.config.ts), but the
 * ~50 call sites that post to /api/* each handle failure their own way and
 * most would show nothing or a generic error. Rather than thread a
 * `readOnly` prop through every page and button, this wraps fetch once for
 * the duration of a demo session: it watches for the 403 marker and shows
 * the explanation, then hands the untouched response back to the caller so
 * each page still runs its own error path (reverting optimistic state, etc.)
 * exactly as it does for any other failed request.
 *
 * Mounted only inside a demo session, so a normal session's fetch is never
 * wrapped at all.
 */
export function DemoReadOnlyNotice() {
  useEffect(() => {
    const original = window.fetch;
    let lastShown = 0;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await original(...args);

      if (response.status === 403) {
        // Reading the body consumes it, so only ever touch a clone.
        void response
          .clone()
          .json()
          .then((body: { code?: string }) => {
            if (body?.code !== DEMO_READ_ONLY_CODE) return;
            // One toast per burst: a bulk edit can fire many requests and
            // they'd otherwise stack up into the same message repeatedly.
            const now = Date.now();
            if (now - lastShown < 1500) return;
            lastShown = now;
            showToast(DEMO_READ_ONLY_MESSAGE, "negative");
          })
          .catch(() => {
            /* Not JSON — some other 403, not ours. */
          });
      }

      return response;
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}
