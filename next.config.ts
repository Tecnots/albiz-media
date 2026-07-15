import type { NextConfig } from 'next'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline and unsafe-eval for hydration scripts and styled components
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      // Allow images from Azure Blob, Google avatars, dicebear, and data/blob URIs
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Allow outbound API calls (Firebase, Stripe, Azure, etc.)
      "connect-src 'self' https: wss:",
      // Allow media from blob URIs (camera/mic captures) and HTTPS
      "media-src 'self' blob: https:",
      // Completely block plugin/object embeds — highest-value XSS mitigation
      "object-src 'none'",
      // Prevent base-tag injection attacks
      "base-uri 'self'",
      // Allow Stripe iframe for payment elements
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      // Allow service workers and blob workers
      "worker-src 'self' blob:",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.60', 'localhost', '127.0.0.1'],
  // ffmpeg-static's prebuilt binary is resolved from disk at runtime (via `require`),
  // not bundled by webpack — keep it external and explicitly trace it into the
  // cron function's output so Vercel actually ships the binary with that function.
  serverExternalPackages: ['ffmpeg-static', 'fluent-ffmpeg'],
  outputFileTracingIncludes: {
    '/api/cron/route': ['./node_modules/ffmpeg-static/**'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  logging: {
    browserToTerminal: process.env.NODE_ENV === 'development',
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
    ],
  },
  typescript: {
    ignoreBuildErrors: false
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Next's image optimizer rejects any upstream host whose DNS resolves to
    // what it classifies as a "private" IP (SSRF hardening). Its checker
    // unwraps legacy ::ffff:a.b.c.d IPv4-mapped addresses but not NAT64's
    // 64:ff9b::a.b.c.d prefix, so on networks that use DNS64/NAT64 synthesis
    // (common on IPv6-only Wi-Fi/VPNs), a real public IPv4 — e.g. our Azure
    // Blob Storage host — gets misclassified as private and every image 404s.
    // Scoped to dev only: production has normal IPv4 connectivity to these
    // hosts, so the SSRF check stays fully active there.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    remotePatterns: [
      // picsum.photos is only used for placeholder/demo data in development
      ...(process.env.NODE_ENV === 'development' ? [
        { protocol: 'https' as const, hostname: 'picsum.photos' },
        { protocol: 'https' as const, hostname: 'i.picsum.photos' },
        { protocol: 'https' as const, hostname: 'fastly.picsum.photos' },
      ] : []),
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
