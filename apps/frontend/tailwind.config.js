/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                authority: {
                    50: "#eff6ff",
                    100: "#dbeafe",
                    500: "#3b82f6",
                    600: "#2563eb",
                    700: "#1d4ed8",
                    900: "#1e3a5f",
                },
                contractor: {
                    50: "#f0fdf4",
                    100: "#dcfce7",
                    500: "#22c55e",
                    600: "#16a34a",
                    700: "#15803d",
                    900: "#14532d",
                },
                audit: {
                    50: "#faf5ff",
                    100: "#f3e8ff",
                    500: "#a855f7",
                    600: "#9333ea",
                    700: "#7e22ce",
                    900: "#581c87",
                },
                chain: {
                    50: "#fefce8",
                    100: "#fef9c3",
                    500: "#eab308",
                    600: "#ca8a04",
                    700: "#a16207",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            animation: {
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "fade-in": "fadeIn 0.5s ease-in-out",
                "slide-up": "slideUp 0.3s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { transform: "translateY(10px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
            },
        },
    },
    plugins: [],
};
