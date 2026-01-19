/** @type {import('next').NextConfig} */
const nextConfig = {
    // SSR-friendly output for Vercel deployment
    output: 'standalone',

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
        // Allow production builds with lint warnings
        ignoreDuringBuilds: true,
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
                ],
            },
        ];
    },
};

module.exports = nextConfig;

