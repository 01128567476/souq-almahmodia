import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Exclude pg (Node.js PostgreSQL client) from client bundles.
  webpack: (config) => {
    config.resolve.fallback = config.resolve.fallback || {};
    config.resolve.fallback.fs = false;
    config.resolve.fallback.net = false;
    config.resolve.fallback.tls = false;
    config.resolve.fallback.dns = false;
    config.resolve.fallback.readline = false;
    config.resolve.fallback.stream = false;
    config.resolve.fallback.path = false;
    config.resolve.fallback.util = false;
    config.resolve.fallback.os = false;
    config.resolve.fallback.assert = false;
    config.resolve.fallback.buffer = false;
    config.resolve.fallback.events = false;
    config.resolve.fallback.pg = false;
    config.resolve.fallback["pg-connection-string"] = false;
    config.resolve.fallback["pg-pool"] = false;
    return config;
  },
};

export default withNextIntl(nextConfig);