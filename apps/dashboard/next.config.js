/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },

    // Suppress build-time errors for pages that require runtime context
    typescript: {
        // Allow production builds even with type errors (for development)
        // Set to true to enforce type safety
        ignoreBuildErrors: false,
    },

    eslint: {
        // Enforce linting during production builds
        ignoreDuringBuilds: false,
    },

    // Rewrites for proxying to standalone services
    // v9.0: 統一 API 閘道 — 所有服務透過 /api/v1/* 代理
    async rewrites() {
        const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3100';
        const aiGatewayUrl = process.env.AI_GATEWAY_URL || 'http://localhost:8080';

        return [
            // ── OpenClaw Gateway (主 Agent 閘道) ───────────────────
            {
                source: '/api/v1/agents/:path*',
                destination: `${gatewayUrl}/agents/:path*`,
            },
            {
                source: '/api/v1/ws',
                destination: `${gatewayUrl}/ws`,
            },
            {
                source: '/api/v1/health',
                destination: `${gatewayUrl}/health`,
            },
            // ── AI Gateway (推理端點) ────────────────────────────
            {
                source: '/api/v1/ai/:path*',
                destination: `${aiGatewayUrl}/ai/:path*`,
            },
            // ── World Monitor (情報中心) — 本機開發 ────────────────
            {
                source: '/intelligence/:path*',
                destination: 'http://localhost:5173/:path*',
            },
            {
                source: '/intelligence',
                destination: 'http://localhost:5173/',
            },
        ];
    },

    // Root redirect — handled at config level to avoid SSG issues
    async redirects() {
        return [
            {
                source: '/',
                destination: '/butler',
                permanent: false,
            },
        ];
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://o4510736967991296.ingest.us.sentry.io https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com;",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;



// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  org: "xxt-agent",
  project: "xxt-dashboard",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Disable source map uploads on Vercel (prevents SSG manifest conflicts)
  sourcemaps: {
    disable: !process.env.CI,
  },

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Disable automatic page wrapping that causes page_client-reference-manifest.js errors
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,
  autoInstrumentAppDirectory: false,

  webpack: {
    automaticVercelMonitors: false,

    treeshake: {
      removeDebugLogging: true,
    },
  },
});
