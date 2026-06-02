import type { Config } from "tailwindcss"

const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "#e5e7eb",
        input: "#d1d5db",
        ring: "#2563eb",
        background: "#ffffff",
        foreground: "#111827",
        primary: { DEFAULT: "#2563eb", foreground: "#ffffff" },
        secondary: { DEFAULT: "#f9fafb", foreground: "#111827" },
        destructive: { DEFAULT: "#dc2626", foreground: "#ffffff" },
        muted: { DEFAULT: "#f9fafb", foreground: "#6b7280" },
        accent: { DEFAULT: "#f9fafb", foreground: "#111827" },
        popover: { DEFAULT: "#ffffff", foreground: "#111827" },
        card: { DEFAULT: "#ffffff", foreground: "#111827" },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.08)",
        md: "0 4px 12px rgba(0,0,0,0.12)",
        lg: "0 8px 24px rgba(0,0,0,0.16)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
