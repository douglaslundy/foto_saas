import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--color-border-strong)",
        input: "var(--color-border-strong)",
        ring: "var(--color-gold)",
        background: "var(--color-surface)",
        foreground: "var(--color-ink)",
        primary: {
          DEFAULT: "var(--color-ink)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--color-surface-alt)",
          foreground: "var(--color-ink)",
        },
        destructive: {
          DEFAULT: "var(--color-danger)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--color-surface-alt)",
          foreground: "var(--color-ink-muted)",
        },
        accent: {
          DEFAULT: "var(--color-surface-alt)",
          foreground: "var(--color-ink)",
        },
        popover: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-ink)",
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-ink)",
        },
        gold: "var(--color-gold)",
        "gold-light": "var(--color-gold-light)",
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
        "ink-muted": "var(--color-ink-muted)",
        surface: "var(--color-surface)",
        "surface-alt": "var(--color-surface-alt)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-sm)",
        sm: "6px",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
