/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07070b',
          900: '#0b0b12',
          850: '#0f0e1a',
          800: '#141324',
          700: '#1c1a32',
          600: '#272445',
          500: '#38345f',
        },
        purple: {
          accent: '#8b5cf6',
          vivid: '#a855f7',
          deep: '#6d28d9',
          glow: '#c084fc',
        },
        neon: {
          purple: '#d946ef',
          cyan: '#38bdf8',
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'neon-purple': '0 0 15px -3px rgba(168, 85, 247, 0.25)',
        'neon-glow': '0 0 25px -2px rgba(139, 92, 246, 0.35)',
      },
    },
  },
  plugins: [],
}
