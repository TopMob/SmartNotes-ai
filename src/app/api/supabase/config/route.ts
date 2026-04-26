import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL ?? null,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY ??
      null,
  });
}
