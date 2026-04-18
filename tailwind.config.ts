import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e6eef7',
          100: '#b3cce8',
          200: '#80aad9',
          300: '#4d88ca',
          400: '#2a6bb8',
          500: '#003A70',
          600: '#003263',
          700: '#002a54',
          800: '#002246',
          900: '#001a37',
          DEFAULT: '#003A70',
        },
        accent: {
          50:  '#e0f7f6',
          100: '#b3ebe8',
          200: '#80deda',
          300: '#4dd1cb',
          400: '#26c6bf',
          500: '#00A99D',
          600: '#009389',
          700: '#007d75',
          800: '#006761',
          900: '#00514d',
          DEFAULT: '#00A99D',
        },
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
      },
      boxShadow: {
        card:        '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover':'0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.06)',
        brand:       '0 4px 6px -1px rgba(0,58,112,0.1), 0 2px 4px -1px rgba(0,58,112,0.06)',
        'brand-lg':  '0 10px 15px -3px rgba(0,58,112,0.1), 0 4px 6px -2px rgba(0,58,112,0.05)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
