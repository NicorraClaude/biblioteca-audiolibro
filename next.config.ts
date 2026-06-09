import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Módulos nativos / Prisma: que el bundler no los empaquete.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  images: {
    // Portadas de Project Gutenberg (Capa 1).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gutenberg.org",
        pathname: "/cache/epub/**",
      },
    ],
  },
};

export default nextConfig;
