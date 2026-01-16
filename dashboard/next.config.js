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
};

module.exports = nextConfig;
