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
  experimental: {
    browserDebugInfoInTerminal: process.env.NODE_ENV === 'development',
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
  webpack: (config, { dev, nextRuntime, webpack }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules', '**/ios/**', '**/android/**', '**/.git/**'],
      };
    }
    if (nextRuntime === 'edge') {
      // next/server.js eagerly requires next/dist/compiled/ua-parser-js (for
      // the userAgent()/isBot() exports), which references `__dirname` at
      // load time. That global doesn't exist on Vercel's Edge Runtime
      // (V8 isolate, not Node.js), so any middleware crashes with
      // "ReferenceError: __dirname is not defined" the moment it imports
      // anything from "next/server" — regardless of what the middleware
      // itself does. This is a known Next.js bug:
      // https://github.com/vercel/next.js/issues/53968
      // DefinePlugin substitutes the identifier at build time (before the
      // module ever runs), which is the only fix that actually lands before
      // the reference is evaluated.
      config.plugins.push(new webpack.DefinePlugin({ __dirname: JSON.stringify('') }));
    }
    return config;
  },
}

export default nextConfig
