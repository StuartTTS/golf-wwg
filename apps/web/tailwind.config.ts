import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        golf: {
          50: '#052e16',
          100: '#064e3b',
          200: '#065f46',
          300: '#047857',
          400: '#059669',
          500: '#10b981',
          600: '#22c55e',
          700: '#4ade80',
          800: '#86efac',
          900: '#bbf7d0',
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
