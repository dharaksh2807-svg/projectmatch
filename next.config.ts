import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/teams",
        destination: "/discover",
      },
    ];
  },
};

export default nextConfig;
