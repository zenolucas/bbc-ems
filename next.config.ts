import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*"] },
  // The ticket renderer's font loading makes Turbopack trace the whole project; keep the Expo app out of functions.
  outputFileTracingExcludes: { "/**": ["./mobile/**"] },
  serverExternalPackages: ["@resvg/resvg-js", "bwip-js"],
  // The Android emulator reaches the dev server as 10.0.2.2 (the app's organiser WebView loads /admin from there)
  allowedDevOrigins: ["10.0.2.2"],
  // Shared with the mobile app; published as TypeScript source.
  transpilePackages: ["@bbc/shared"],
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
