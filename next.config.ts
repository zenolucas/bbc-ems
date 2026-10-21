import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*"] },
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
