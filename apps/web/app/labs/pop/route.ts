import { NextResponse, type NextRequest } from "next/server";
import { UI_FLAG_COOKIE, UI_FLAG_POP } from "@/lib/uiFlag";

/**
 * `GET /labs/pop` turns on the Tally Pop UI preview for this browser and
 * lands on the Overview; `GET /labs/pop?off` turns it back off. Link-only
 * on purpose: no button anywhere in the app points here.
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
  } else {
    response.cookies.set(UI_FLAG_COOKIE, UI_FLAG_POP, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
