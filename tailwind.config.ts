import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        night: "#0A1A3A",
        ink: "#12172B",
        paper: "#F6F7F2",
        mist: "#E6E8E0",
        line: "#D9DCD2",
        gold: {
          DEFAULT: "#E8A33D",
          soft: "#F4D9A8",
          deep: "#B87A1E",
        },
        teal: {
          DEFAULT: "#1E8A7A",
          soft: "#BFE3DB",
          deep: "#0F5850",
        },
        indigo: {
          DEFAULT: "#3D4EA6",
          soft: "#C6CCEE",
          deep: "#232E6E",
        },
        coral: {
          DEFAULT: "#D9614F",
          soft: "#F3C8C1",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,23,43,0.06), 0 8px 24px -8px rgba(18,23,43,0.12)",
        badge: "0 2px 8px rgba(18,23,43,0.18)",
      },
      keyframes: {
        "badge-fly": {
          "0%": { transform: "scale(0.4) translateY(40px)", opacity: "0" },
          "60%": { transform: "scale(1.08) translateY(-6px)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        "compass-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
      },
      animation: {
        "badge-fly": "badge-fly 0.6s cubic-bezier(0.16,1,0.3,1)",
        "compass-spin": "compass-spin 1.2s linear infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
