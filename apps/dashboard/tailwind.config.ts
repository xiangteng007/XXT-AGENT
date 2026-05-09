import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Aurelian Logic Theme
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                // Aurelian Logic Palette
                "on-secondary-fixed-variant": "#5e5b55",
                "secondary-fixed-dim": "#d9d4cb",
                "tertiary-dim": "#5f5045",
                "error-dim": "#5c1202",
                "on-tertiary": "#fff7f4",
                "error": "#9e422c",
                "inverse-on-surface": "#9c9d9d",
                "tertiary-fixed-dim": "#eed9ca",
                "inverse-surface": "#0c0f0f",
                "tertiary-fixed": "#fde7d7",
                "on-error": "#fff7f6",
                "surface-variant": "#dde4e5",
                "error-container": "#fe8b70",
                "on-error-container": "#742410",
                "secondary-fixed": "#e7e2d9",
                "on-secondary": "#fef8ef",
                "on-primary-fixed-variant": "#705900",
                "on-background": "#2d3435",
                "on-surface-variant": "#5a6061",
                "outline": "#757c7d",
                "surface": "#f9f9f9",
                "primary-fixed-dim": "#f4d16f",
                "on-secondary-fixed": "#413f39",
                "surface-dim": "#d4dbdd",
                "on-tertiary-fixed": "#504237",
                "on-primary-container": "#654f00",
                "on-primary-fixed": "#4f3d00",
                "on-tertiary-container": "#635448",
                "surface-bright": "#f9f9f9",
                "primary-fixed": "#ffe08a",
                "secondary-container": "#e7e2d9",
                "on-tertiary-fixed-variant": "#6d5e52",
                "outline-variant": "#adb3b4",
                "tertiary-container": "#fde7d7",
                "surface-container-high": "#e4e9ea",
                "surface-container-lowest": "#ffffff",
                "inverse-primary": "#fdda77",
                "on-primary": "#fff7ea",
                "primary-container": "#ffe08a",
                "secondary-dim": "#55534c",
                "primary-dim": "#655000",
                "surface-container-low": "#f2f4f4",
                "surface-container": "#ebeeef",
                "on-surface": "#2d3435",
                "surface-tint": "#745b00",
                "surface-container-highest": "#dde4e5",
                "tertiary": "#6c5c50",
                "on-secondary-container": "#54514b",
                // Severity colors
                severity: {
                    critical: "#9e422c",
                    high: "#fe8b70",
                    medium: "#745b00",
                    low: "#55534c",
                },
            },
            fontFamily: {
                headline: ["Manrope", "sans-serif"],
                body: ["Inter", "sans-serif"],
                label: ["Inter", "sans-serif"],
                sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "slide-up": {
                    from: { transform: "translateY(20px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.15s ease",
                "slide-up": "slide-up 0.25s ease",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
