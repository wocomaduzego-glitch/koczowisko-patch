import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Koczowisko Web", short_name: "Koczowisko",
    description: "Twoja muzyka, playlisty i grupy — w przeglądarce.",
    lang: "pl", start_url: "/web", scope: "/", display: "standalone",
    background_color: "#f5f5f2", theme_color: "#f5f5f2",
    categories: ["music", "entertainment"],
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
