import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  async rewrites() {
    const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/audio/:id/:field",
        destination: `${rustApiUrl}/api/audio/:id/:field`,
      },
      {
        source: "/api/diag/:path*",
        destination: `${rustApiUrl}/api/diag/:path*`,
      },
    ];
  },
};

export default withSerwist(nextConfig);
