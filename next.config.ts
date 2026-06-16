import type { NextConfig } from 'next'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  experimental: {
    browserDebugInfoInTerminal: true,
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/core',
    ],
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'albizmedia.blob.core.windows.net' },
      { protocol: 'https', hostname: 'aichatbotcdn.blob.core.windows.net' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.etb2bimg.com' },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules', '**/ios/**', '**/android/**', '**/.git/**'],
      };
    }
    return config;
  },
}

export default nextConfig
