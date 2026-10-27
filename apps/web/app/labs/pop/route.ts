import { NextResponse, type NextRequest } from "next/server";
import { UI_FLAG_COOKIE, UI_POP, UI_PREF_COOKIE } from "@/lib/uiFlag";

/**
 * `GET /labs/pop` turns on the Tally Pop feature flag for this browser,
 * starts it on the new look, and lands on the Overview. From then on the
 * sidebar's "New look" switch flips between Pop and the current UI.
 * `GET /labs/pop?off` removes the flag, the switch, and Pop. Link-only on
 * purpose: nothing in the app points here.
 *
 * Behind the middleware's session gate like every app route, so only a
 * signed-in visitor can flip it. It's a GET, so another site could trigger
 * it with an <img>, but the worst that does is change how this browser
 * draws Tally.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/overview", request.url));
  if (request.nextUrl.searchParams.has("off")) {
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
