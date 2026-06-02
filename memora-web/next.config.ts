import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: true, // Force disable to clear stale cache on Railway
  register: true,
});

const nextConfig: NextConfig = {
  async rewrites() {
    const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/a2/:path*",
        destination: `${rustApiUrl}/api/a2/:path*`,
      },
      {
        source: "/api/tts",
        destination: `${rustApiUrl}/api/tts`,
      },
      {
        source: "/api/audio/transcribe",
        destination: `${rustApiUrl}/api/audio/transcribe`,
      },
      {
        source: "/api/audio/:id/:field",
        destination: `${rustApiUrl}/api/audio/:id/:field`,
      },
      {
        source: "/api/diag/:path*",
        destination: `${rustApiUrl}/api/diag/:path*`,
      },
      {
        source: "/api/ai/:path*",
        destination: `${rustApiUrl}/api/ai/:path*`,
      },
      {
        source: "/api/sets/:path*",
        destination: `${rustApiUrl}/api/sets/:path*`,
      },
      {
        source: "/api/study/:path*",
        destination: `${rustApiUrl}/api/study/:path*`,
      },
      {
        source: "/api/folders/:path*",
        destination: `${rustApiUrl}/api/folders/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${rustApiUrl}/api/users/:path*`,
      },
      {
        source: "/api/images/:path*",
        destination: `${rustApiUrl}/api/images/:path*`,
      },
      {
        source: "/api/live/:path*",
        destination: `${rustApiUrl}/api/live/:path*`,
      },
    ];
  },
};

export default withSerwist(nextConfig);
