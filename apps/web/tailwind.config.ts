import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        golf: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#0a3d1f',
          950: '#052e16',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#d4a843',
          600: '#b8860b',
          700: '#92711c',
        },
        surface: {
          50: '#f0f9f4',
          100: '#dceee4',
          200: '#b5cec2',
          300: '#8ba89c',
          400: '#5a7268',
          500: '#3d4f44',
          600: '#2a3830',
          700: '#1e2a24',
          800: '#161e1a',
          900: '#0f1512',
          950: '#080c0a',
        },
        dark: {
          50: '#0f1219',
          100: '#161b25',
          200: '#1e2431',
          300: '#2d3748',
          400: '#3d4a5c',
          500: '#4a5568',
          600: '#64748b',
          700: '#94a3b8',
          800: '#cbd5e1',
          900: '#e2e8f0',
        },
        'score-eagle': '#d4a843',
        'score-birdie': '#ef4444',
        'score-par': '#f0f9f4',
        'score-bogey': '#3b82f6',
        'score-double': '#1e40af',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(34,197,94,0.05)',
        elevated: '0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,197,94,0.08)',
        glow: '0 0 0 2px rgba(212,168,67,0.3)',
      },
      borderRadius: {
        'golf-sm': '6px',
        golf: '10px',
        'golf-lg': '16px',
      },
      transitionTimingFunction: {
        golf: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        golf: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
