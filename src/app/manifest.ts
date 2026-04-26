import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SmartNotes",
    short_name: "SmartNotes",
    description: "Интеллектуальные заметки с semantic search, reminders и BYOS-медиа.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#7c3aed",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
  };
}
