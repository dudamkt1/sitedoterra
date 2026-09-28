import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 63136000,
  },
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "@supabase/ssr", "jspdf", "jspdf-autotable", "qrcode", "stripe", "@stripe/stripe-js"],
  },
  // DEV ONLY: `@ffmpeg/ffmpeg` usa `new URL('/node_modules/@ffmpeg/core/...')`
  // quando NODE_ENV=development; o webpack não resolve esse caminho e a build
  // local quebrava (página em branco) para tudo que importa MediaUploader.
  webpack(config, { dev }) {
    if (dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "/node_modules/@ffmpeg/core/dist/ffmpeg-core.js": path.join(dir, "lib/media/ffmpeg-core-stub.js"),
      };
    }
    return config;
  },

  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "@supabase/ssr", "jspdf", "jspdf-autotable", "qrcode", "stripe", "@stripe/stripe-js"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // cache agressivo para assets imutáveis do _next
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // PWA: manifest e service worker NÃO podem ser cacheados por CDNs/proxies.
      // Sem isso, o navegador pode servir um manifest antigo e o ícone nunca atualizar.
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
