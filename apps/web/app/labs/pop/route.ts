import { NextResponse, type NextRequest } from "next/server";
import { UI_CLASSIC, UI_FLAG_COOKIE, UI_POP, UI_PREF_COOKIE } from "@/lib/uiFlag";
import { isDemoSession, requireUserId } from "@/lib/session";
import { setUserUiLook } from "@/lib/uiLook";

/**
 * A shortcut to the look, from before Tally Pop was the default (now the
 * side nav's "New look" switch does this): `GET /labs/pop` picks Pop and
 * `GET /labs/pop?off` the classic look, for this browser (cookie) and the
 * account (users.ui_look, which emails and mobile read), then lands on the
 * Overview. Clears the old preview flag cookie either way. The demo account
 * is read-only, so only its cookie changes.
 *
 * Behind the middleware's session gate like every app route. It's a GET, so
 * another site could trigger it with an <img>, but the worst that does is
 * change how Tally looks.
 */
export async function GET(request: NextRequest) {
  const classic = request.nextUrl.searchParams.has("off");

  if (!(await isDemoSession())) {
    try {
      await setUserUiLook(await requireUserId(), classic ? UI_CLASSIC : UI_POP);
    } catch (err) {
      console.error("[labs/pop] couldn't save ui_look", err);
    }
  }

  const response = NextResponse.redirect(new URL("/overview", request.url));
  response.cookies.delete(UI_FLAG_COOKIE);
  response.cookies.set(UI_PREF_COOKIE, classic ? UI_CLASSIC : UI_POP, {
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
