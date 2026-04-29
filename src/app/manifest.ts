import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SmartNotes",
    short_name: "SmartNotes",
    description: "Интеллектуальные заметки с semantic search, reminders и BYOS-медиа.",
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
  };
}
