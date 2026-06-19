import type { NextConfig } from "next";
import path from "path";

// Direct Supabase origin (e.g. https://<ref>.supabase.co). Used as the rewrite target.
const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL ?? "";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  /**
   * BFF reverse-proxy for Supabase REST/Auth/Storage.
   *
   * In RU networks the `*.supabase.co` domain (AWS/Cloudflare) is frequently
   * throttled/blocked by DPI, so the browser's *direct* request hangs until it
   * times out — that is the main reason the app "won't load" there. By tunnelling
   * those calls through our own origin (`/-/supabase/*`), the request the browser
   * makes is same-origin; the server-to-server hop Vercel → Supabase is not subject
   * to client-side DPI. The browser client opts into this path in `supabase/client.ts`.
   *
   * Realtime (WebSocket) is intentionally NOT proxied — it stays direct and simply
   * degrades gracefully if unreachable, so collaboration never blocks initial load.
   */
  async rewrites() {
    if (!SUPABASE_ORIGIN) {
      return [];
    }

    return [
      {
        source: "/-/supabase/:path*",
        destination: `${SUPABASE_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
