import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        gray: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          750: '#293548',
          800: '#1E293B',
          900: '#0F172A',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        pink: { 500: '#EC4899' },
        cyan: { 500: '#06B6D4' },
        violet: { 500: '#8B5CF6' },
        teal: { 500: '#14B8A6' },
        app: '#0B1220',
      },
      fontFamily: {
        display: ['IBM Plex Sans Arabic', 'sans-serif'],
        body: ['IBM Plex Sans Arabic', 'sans-serif'],
        numeric: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Sans Arabic', 'sans-serif'],
      },
      spacing: {
        'sp-1': '4px',
        'sp-2': '8px',
        'sp-4': '16px',
        'sp-6': '24px',
        'sp-8': '32px',
        'sp-12': '48px',
      },
      borderRadius: {
        'r-sm': '4px',
        'r-md': '8px',
        'r-lg': '12px',
        'r-xl': '16px',
        'r-2xl': '24px',
        'r-full': '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        brand: '0 4px 14px 0 rgb(99 102 241 / 0.3)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
        spring: '400ms',
      },
      zIndex: {
        dropdown: '100',
        modal: '400',
        toast: '500',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease both',
        shimmer: 'shimmer 1500ms infinite',
        'spin-slow': 'spin 1000ms linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
