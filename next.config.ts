import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Silence the multi-lockfile workspace-root inference (backend lockfile is a sibling).
  turbopack: { root: projectRoot },
  images: {
    // Destination photos are hosted externally (URL-based, no upload API yet),
    // so image hosts are not known ahead of time (seed uses picsum.photos, real
    // data may use any host). Allow any HTTPS host; keep http for localhost dev.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
