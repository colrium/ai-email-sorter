import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Enable standalone output for Docker
  output: "standalone",

  // Enable server actions
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // Material UI configuration
  transpilePackages: ["@mui/material", "@mui/system", "@mui/icons-material"],

  // Environment variables available to the browser
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  // Turbopack configuration (Next.js 16+)
  turbopack: {},

  // Webpack configuration for Puppeteer (if needed) - only when using webpack
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        puppeteer: "commonjs puppeteer",
      });
    }
    return config;
  },
};

export default nextConfig;
