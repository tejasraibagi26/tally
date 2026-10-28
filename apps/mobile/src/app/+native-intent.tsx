import { appPathForWebPath } from "@tally/core/appLinks";

// Web paths the app knows how to open: email buttons go through the web's
// /open page, which hands off tally://<web path> (no universal links
// without a paid Apple Developer account). Anything else passes through
// to expo-router unchanged.
const WEB_PATH = /^\/(overview|transactions|cards|tags|settings|year-in-review|budgets|accounts|subscriptions|goals|investments|fire|upcoming|alerts|safe-to-spend)?(?=\/|\?|#|$)/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const p = path.startsWith("tally://") ? `/${path.slice("tally://".length)}` : path;
    return p.startsWith("/") && WEB_PATH.test(p) ? appPathForWebPath(p) : path;
  } catch {
    return path;
  }
}
