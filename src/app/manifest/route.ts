import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: "SmartNotes AI",
    short_name: "SmartNotes",
    description: "Next-gen notes application with AI and collaboration",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
