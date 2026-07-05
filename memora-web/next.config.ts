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
        source: "/api/classes/:path*",
        destination: `${rustApiUrl}/api/classes/:path*`,
      },
      {
        source: "/api/assignments/:path*",
        destination: `${rustApiUrl}/api/assignments/:path*`,
      },
      {
        source: "/api/subscriptions/:path*",
        destination: `${rustApiUrl}/api/subscriptions/:path*`,
      },
      {
        source: "/api/subscriptions",
        destination: `${rustApiUrl}/api/subscriptions`,
      },
      {
        source: "/api/courses/:path*",
        destination: `${rustApiUrl}/api/courses/:path*`,
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
      // Источники/учебники (slice 13). Bare-путь отдельной записью — /api/sources
      // (GET list / POST upload) вызывается без подпути.
      {
        source: "/api/sources/:path*",
        destination: `${rustApiUrl}/api/sources/:path*`,
      },
      {
        source: "/api/sources",
        destination: `${rustApiUrl}/api/sources`,
      },
      // Символьная проверка (CAS, slice 17).
      {
        source: "/api/check/:path*",
        destination: `${rustApiUrl}/api/check/:path*`,
      },
      // Семейное табло (slice 18).
      {
        source: "/api/family/:path*",
        destination: `${rustApiUrl}/api/family/:path*`,
      },
      // Push-подписки (slice 20).
      {
        source: "/api/push/:path*",
        destination: `${rustApiUrl}/api/push/:path*`,
      },
    ];
  },
};

export default withSerwist(nextConfig);
