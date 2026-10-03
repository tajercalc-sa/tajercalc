import type { NextConfig } from "next";

// Static export: the whole site is plain HTML/JS, so it can be hosted free
// (GitHub Pages, Cloudflare Pages, Netlify) with no server.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
