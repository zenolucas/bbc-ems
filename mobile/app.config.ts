import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json holds the config; this only adjusts it per build variant. APP_VARIANT=demo
 * (eas.json's "demo" profile) builds "BBC Demo": its own package id, so it installs
 * next to the real app instead of replacing it, pointed at the demo deployment.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.APP_VARIANT !== "demo") return config as ExpoConfig;
  return {
    ...config,
    name: "BBC Demo",
    slug: config.slug ?? "bbc-ems",
    scheme: "bbcems-demo",
    ios: { ...config.ios, bundleIdentifier: "ph.baguiobasecamp.app.demo" },
    android: { ...config.android, package: "ph.baguiobasecamp.app.demo" },
  };
};
