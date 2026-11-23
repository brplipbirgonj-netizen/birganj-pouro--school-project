
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── Performance: compress responses ──────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // ── Performance: optimise package imports (tree-shake large libs) ────────
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-avatar',
      '@radix-ui/react-popover',
      'recharts',
      'date-fns',
    ],
  },

  images: {
    // Use WebP/AVIF on supporting browsers
    formats: ['image/avif', 'image/webp'],
    // Aggressive caching for remote images (1 week)
    minimumCacheTTL: 604800,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ibb.co', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ibb.co', pathname: '/**' },
      { protocol: 'https', hostname: 'ibb.co.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ibb.co.com', pathname: '/**' },
      { protocol: 'https', hostname: 'postimg.cc', pathname: '/**' },
      { protocol: 'https', hostname: 'i.postimg.cc', pathname: '/**' },
      { protocol: 'https', hostname: '1drv.ms', pathname: '/**' },
      { protocol: 'https', hostname: 'onedrive.live.com', pathname: '/**' },
      { protocol: 'https', hostname: 'public.db.files.1drv.com', pathname: '/**' },
      { protocol: 'https', hostname: 'imgur.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.imgur.com', pathname: '/**' },
    ],
  },

  async headers() {
    return [
      // Static assets — long-lived immutable cache
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Fonts — long-lived cache
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Dynamic manifests & icons — no cache (always fresh)
      {
        source: '/:path*(webmanifest|json|ico)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // Images served from /public — moderate cache (1 day)
      {
        source: '/:path*(png|jpg|jpeg|svg|gif|webp)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      // Service worker — never cache
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // All pages — security + performance headers
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
