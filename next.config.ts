import type { NextConfig } from "next";

// Auto-map Supabase Vercel integration variables if standard names aren't set
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  "";

const directUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  "";

if (!process.env.DATABASE_URL && dbUrl) {
  process.env.DATABASE_URL = dbUrl;
}
if (!process.env.DIRECT_URL && directUrl) {
  process.env.DIRECT_URL = directUrl;
}

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: dbUrl,
    DIRECT_URL: directUrl,
  },
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
