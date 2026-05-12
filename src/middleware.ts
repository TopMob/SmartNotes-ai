import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSupabaseSession } from "@/shared/api/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const getUserResult = await updateSupabaseSession(request, response);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/") || pathname.startsWith("/auth/");
  const isAuthenticated = getUserResult?.data?.user != null;


  if (isAuthenticated && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }


  if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
