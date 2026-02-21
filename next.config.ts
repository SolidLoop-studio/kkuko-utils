import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
        pathname: '/kkuko/**',
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
  },
};

export default nextConfig;
