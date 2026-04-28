import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSupabaseSession } from "@/shared/api/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  await updateSupabaseSession(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
