import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    browserDebugInfoInTerminal: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
}

export default nextConfig
