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
      {
        protocol: 'https',
        hostname: 'albizmedia.blob.core.windows.net',
      },
    ],
  },
}

export default nextConfig
