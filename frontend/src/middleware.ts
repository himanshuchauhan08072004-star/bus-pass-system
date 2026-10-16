import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// UX-only guard: redirects visitors with no session cookie to the login page.
// It does NOT authorise anything. The backend verifies the session, the user's
// role and CSRF on every request.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("tf_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
