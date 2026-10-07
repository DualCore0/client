import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "tertiary-container": "#007c72", "inverse-surface": "#213145", "on-surface": "#0b1c30",
        "on-secondary-fixed": "#131b2e", "inverse-primary": "#bac3ff", "primary-fixed-dim": "#bac3ff",
        "surface-tint": "#2549ed", "surface-container-high": "#dce9ff", "surface-container-lowest": "#ffffff",
        "secondary-fixed": "#dae2fd", "on-secondary": "#ffffff", "tertiary-fixed": "#89f5e7",
        "on-error-container": "#93000a", "primary-fixed": "#dee0ff", "primary": "#143ee4",
        "on-tertiary-container": "#bbfff4", "on-primary-fixed-variant": "#002fc9", "on-primary-fixed": "#00105b",
        "tertiary": "#006159", "surface": "#f8f9ff", "background": "#f8f9ff", "secondary": "#565e74",
        "on-error": "#ffffff", "error-container": "#ffdad6", "error": "#ba1a1a", "on-background": "#0b1c30",
        "surface-container-highest": "#d3e4fe", "on-tertiary-fixed": "#00201d", "outline": "#747687",
        "surface-container-low": "#eff4ff", "secondary-fixed-dim": "#bec6e0", "outline-variant": "#c4c5d9",
        "surface-dim": "#cbdbf5", "surface-variant": "#d3e4fe", "surface-container": "#e5eeff",
        "on-tertiary-fixed-variant": "#005049", "primary-container": "#3b5bfd", "on-surface-variant": "#444656",
        "inverse-on-surface": "#eaf1ff", "secondary-container": "#dae2fd", "tertiary-fixed-dim": "#6bd8cb",
        "on-secondary-container": "#5c647a", "on-primary-container": "#f1f0ff", "on-secondary-fixed-variant": "#3f465c",
        "surface-bright": "#f8f9ff", "on-primary": "#ffffff", "on-tertiary": "#ffffff"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        "margin-mobile": "1rem", "space-xs": "0.5rem", "margin": "2rem", "gutter": "1.5rem",
        "space-sm": "0.75rem", "space-2xs": "0.25rem", "space-2xl": "3rem", "space-xl": "2rem",
        "space-lg": "1.5rem", "space-md": "1rem", "gutter-mobile": "1rem"
      },
      fontFamily: {
        "body-sm": ["var(--font-hanken)"], "stat-mono-lg": ["var(--font-jetbrains)"],
        "body-lg": ["var(--font-hanken)"], "headline-lg": ["var(--font-hanken)"],
        "label-mono": ["var(--font-jetbrains)"], "headline-sm": ["var(--font-hanken)"],
        "headline-lg-mobile": ["var(--font-hanken)"], "display-lg": ["var(--font-hanken)"],
        "headline-md": ["var(--font-hanken)"], "label-mono-sm": ["var(--font-jetbrains)"],
        "body-md": ["var(--font-hanken)"], "display-lg-mobile": ["var(--font-hanken)"]
      },
      fontSize: {
        "body-sm": ["13px", { lineHeight: "18px", letterSpacing: "0.005em", fontWeight: "400" }],
        "stat-mono-lg": ["28px", { lineHeight: "34px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "body-lg": ["17px", { lineHeight: "26px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "label-mono": ["12px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "500" }],
        "headline-sm": ["18px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-lg": ["44px", { lineHeight: "52px", letterSpacing: "-0.03em", fontWeight: "700" }],
        "headline-md": ["22px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "label-mono-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.06em", fontWeight: "500" }],
        "body-md": ["15px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }],
        "display-lg-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.025em", fontWeight: "700" }]
      }
    },
  },
  plugins: [],
};

export default config;
