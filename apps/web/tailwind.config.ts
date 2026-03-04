import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand tokens
        brand: {
          50:  '#f0f4ff',
          100: '#dde5ff',
          200: '#c0ceff',
          300: '#93a8ff',
          400: '#6070f8',
          500: '#3d4bef',
          600: '#2a31d6',
          700: '#2227ae',
          800: '#21258c',
          900: '#21256e',
          950: '#131448',
        },
        // Surface tokens (light)
        surface: {
          base:      '#ffffff',
          raised:    '#f8f9fc',
          overlay:   '#f0f2f8',
          border:    '#e2e6f0',
        },
        // Surface tokens (dark) — used via CSS vars in components
        'surface-dark': {
          base:      '#0f1117',
          raised:    '#1a1d27',
          overlay:   '#22263a',
          border:    '#2e3250',
        },
        // Semantic text
        ink: {
          primary:   '#0d0f1a',
          secondary: '#4b5275',
          muted:     '#8a92b2',
        },
        'ink-dark': {
          primary:   '#e8eaf6',
          secondary: '#9499bf',
          muted:     '#5a607a',
        },
        // Accent
        accent: {
          success: '#22c55e',
          warning: '#f59e0b',
          error:   '#ef4444',
          info:    '#38bdf8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        nav: '14rem',
        inspector: '18rem',
      },
      borderRadius: {
        panel: '0.75rem',
      },
    },
  },
  plugins: [],
}

export default config
