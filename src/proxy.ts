import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

// Everything except the login pages, the Better Auth handler (the link from the email leads there),
// /health (the deploy checks it without login) and static files. These paths never reach proxy().
export const config = {
  matcher: [
    "/((?!login(?:/|$)|api/auth(?:/|$)|health(?:/|$)|_next/static|_next/image|favicon\\.ico).*)",
  ],
};

// Nobody signed in: to the login page. Somebody signed in: let the request through and pass on the
// cookie with the term moved forward. Only a proxy can do that: pages and server components cannot
// set cookies, so without this the cookie of the browser would end 30 days after the login,
// however often the person visits. The data checks are on every page and in every action
// (requireUser), this is only the first gate.
export async function proxy(request: NextRequest) {
  const { headers, response: session } = await getAuth().api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  for (const cookie of headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
