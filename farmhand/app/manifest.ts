import type { MetadataRoute } from "next";

/** PWA manifest — lets the phone install Farmhand to the home screen and run
    it full-screen like a native app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Farmhand — Coyote & Co.",
    short_name: "Farmhand",
    description: "The lead engine, content studio, and local-presence system.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B16",
    theme_color: "#0B0B16",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
