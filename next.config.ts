import type { NextConfig } from 'next';

const CDN = 'https://yv-content-assets.youversionapi.com';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      // Stream YouVersion media same-origin so the cross-origin CDN video can be
      // drawn onto the canvas without tainting it (CDN sends no CORS headers).
      { source: '/yvmedia/:path*', destination: `${CDN}/:path*` },
    ];
  },
};

export default nextConfig;
