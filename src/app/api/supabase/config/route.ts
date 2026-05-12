import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL ?? null,
      publishableKey:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY ??
        null,
      googleClientId:
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
        process.env.GOOGLE_CLIENT_ID ??
        process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_GOOGLE_CLIENT_ID ??
        process.env.NEXT_PUBLIC_SMARTNOTES_GOOGLE_CLIENT_ID ??
        null,
    },
    {
      headers: {

        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
