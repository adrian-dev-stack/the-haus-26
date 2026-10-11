/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client", "libsql"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.paymongo.com https://*.turso.io https://*.libsql.org wss://*.turso.io",
              "frame-src 'self' https://www.google.com https://maps.google.com",
              "frame-ancestors 'self'",
              "form-action 'self' https://checkout.paymongo.com",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
      ...["/pay/:path*", "/payment/:path*", "/book/:path*", "/admin/:path*", "/api/payments/:path*", "/api/bookings/:path*", "/api/admin/:path*"].map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      })),
    ];
  },
};

export default nextConfig;
