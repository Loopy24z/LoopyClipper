import type { NextConfig } from "next";
const nextConfig: NextConfig = { turbopack: {root: process.cwd()}, async redirects() { return ["/", "/login", "/ugc"].map(source => ({source, has: [{type: "host" as const, value: "loopyclipper.vercel.app"}], destination: `https://loofyai.vercel.app${source}`, permanent: false})); } };
export default nextConfig;
