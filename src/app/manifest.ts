import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baguio Base Camp",
    short_name: "BBC",
    description: "Events, gigs and paperless tickets for Baguio Base Camp.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1c20",
    theme_color: "#1b5e3b",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
