import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*"] },
  // The ticket renderer's font loading makes Turbopack trace the whole project; keep the Expo app out of functions.
  outputFileTracingExcludes: { "/**": ["./mobile/**"] },
  serverExternalPackages: ["@resvg/resvg-js", "bwip-js"],
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
