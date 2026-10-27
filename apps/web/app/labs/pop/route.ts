import { NextResponse, type NextRequest } from "next/server";
import { UI_FLAG_COOKIE, UI_POP, UI_PREF_COOKIE } from "@/lib/uiFlag";
import { isDemoSession, requireUserId } from "@/lib/session";
import { setUserUiLook } from "@/lib/uiLook";

/**
 * `GET /labs/pop` turns on the Tally Pop feature flag for this browser and
 * this account, starts on the new look, and lands on the Overview. From then
 * on the sidebar's "New look" switch flips between Pop and the current UI.
 * `GET /labs/pop?off` removes the flag, the switch, and Pop. Link-only on
 * purpose: nothing in the app points here.
 *
 * The cookie restyles this browser; users.ui_look (lib/uiLook.ts) is what
 * emails read. The demo account is read-only, so only its cookie changes.
 *
 * Behind the middleware's session gate like every app route, so only a
 * signed-in visitor can flip it. It's a GET, so another site could trigger
 * it with an <img>, but the worst that does is change how Tally looks.
 */
export async function GET(request: NextRequest) {
  const off = request.nextUrl.searchParams.has("off");

  if (!(await isDemoSession())) {
    try {
      await setUserUiLook(await requireUserId(), off ? null : UI_POP);
    } catch (err) {
      // The browser flag still works without the account copy; only emails
      // would keep their current template.
      console.error("[labs/pop] couldn't save ui_look", err);
    }
  }

  const response = NextResponse.redirect(new URL("/overview", request.url));
  if (off) {
    response.cookies.delete(UI_FLAG_COOKIE);
    response.cookies.delete(UI_PREF_COOKIE);
  } else {
    const options = {
      path: "/",
      sameSite: "lax" as const,
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
    };
    response.cookies.set(UI_FLAG_COOKIE, "1", options);
    response.cookies.set(UI_PREF_COOKIE, UI_POP, options);
  }
  return response;
}
