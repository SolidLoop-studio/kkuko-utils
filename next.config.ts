import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['lucide-react'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sjqbafovqiydkndodbsb.supabase.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: 'https',
        hostname: 'cdn.kkutu.co.kr',
        port: '',
        pathname: '/img/**',
      },
      {
        protocol: 'https',
        hostname: 'api.solidloop-studio.xyz',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/**',
      }
    ],
    localPatterns: [
      {
        pathname: '/api/kkuko/image',
      },
      {
        pathname: '/img/**',
      },
    ],
    minimumCacheTTL: 2592000,
  },
};

export default nextConfig;
