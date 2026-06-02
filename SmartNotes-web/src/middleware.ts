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
  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest" ||
    pathname.startsWith("/apple-icon");
  const isGuest = request.cookies.has("smartnotes_guest");
  const isAuthenticated = getUserResult?.data?.user != null || isGuest;


  let activeResponse = response;

  if (isAuthenticated && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    activeResponse = NextResponse.redirect(homeUrl);
  } else if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    activeResponse = NextResponse.redirect(loginUrl);
  }

  if (!isAuthenticated) {
    activeResponse.cookies.delete("sb-provider-token");
    activeResponse.cookies.delete("sb-provider-refresh-token");
  }

  if (activeResponse !== response) {
    response.cookies.getAll().forEach((cookie) => {
      if (cookie.name !== "sb-provider-token" && cookie.name !== "sb-provider-refresh-token") {
        activeResponse.cookies.set(cookie);
      }
    });
  }

  return activeResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
