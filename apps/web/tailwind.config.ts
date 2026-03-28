import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Skill recommendation: Fira Code for KPI values (tabular, monospaced)
        // Fira Sans for body copy
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
        sans: ['Fira Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Dark palette: deep slate, not pure OLED black
        // Skill: Real-Time Monitoring + Dark Mode (OLED) hybrid
        surface: {
          page:   '#0f172a', // slate-900 — page background
          card:   '#1e293b', // slate-800 — card surface
          raised: '#293548', // between slate-800 and slate-700 — elevated cards
          inset:  '#0d1726', // darker than page — chart plot area
          border: '#334155', // slate-700 — card borders
        },
        // Text hierarchy on dark
        content: {
          primary:   '#f1f5f9', // slate-100
          secondary: '#94a3b8', // slate-400
          muted:     '#64748b', // slate-500
        },
        // Brand/solar — solar gold
        solar: {
          DEFAULT: '#f59e0b', // amber-500
          dim:     '#78450a', // amber very dim for bg tints
          glow:    'rgba(245,158,11,0.15)',
        },
        // State colours (from skill: --live-indicator, --critical-color)
        live: {
          DEFAULT: '#22c55e', // green-500 — healthy/fresh
          dim:     '#052e16', // green very dim
          glow:    'rgba(34,197,94,0.15)',
        },
        stale: {
          DEFAULT: '#f97316', // orange-500 — from skill CTA/warning
          dim:     '#431407',
          glow:    'rgba(249,115,22,0.12)',
        },
        alert: {
          DEFAULT: '#ef4444', // red-500 — disconnected
          dim:     '#2d0808',
          glow:    'rgba(239,68,68,0.12)',
        },
        // Chart series on dark (skill: fading opacity for history)
        chart: {
          generation:  '#fbbf24', // amber-400 — solar
          consumption: '#64748b', // slate-500
          import:      '#334155', // slate-700 — dim
          export:      '#34d399', // emerald-400 — positive
        },
      },
      keyframes: {
        // Skill: --pulse-animation: pulse 2s infinite for live indicator
        livePulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.4', transform: 'scale(1.15)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'live-pulse': 'livePulse 2s ease-in-out infinite',
        shimmer:      'shimmer 1.8s linear infinite',
        'fade-in':    'fadeIn 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
