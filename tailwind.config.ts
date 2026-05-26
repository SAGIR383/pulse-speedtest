import type { Config } from 'tailwindcss';

/**
 * Pulse design system.
 * Palette: deep atmospheric graphite/midnight base, titanium neutrals,
 * with aurora accents (soft cyan -> ambient violet). No flat neon.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Atmospheric backgrounds
        void: {
          DEFAULT: '#05060a',
          50: '#0a0c12',
          100: '#0d0f17',
          200: '#11141e',
          300: '#161a26',
        },
        // Titanium neutrals
        titanium: {
          50: '#f4f6fb',
          100: '#dfe3ee',
          200: '#b9c0d4',
          300: '#8b94ad',
          400: '#5f6781',
          500: '#3f465c',
        },
        // Aurora accents
        aurora: {
          cyan: '#5ee7e0',
          ice: '#7cc6ff',
          violet: '#9d8cff',
          ember: '#ff9d7a',
          mint: '#7affc4',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'aurora-mesh':
          'radial-gradient(at 18% 22%, rgba(94,231,224,0.16) 0px, transparent 45%), radial-gradient(at 82% 18%, rgba(157,140,255,0.18) 0px, transparent 50%), radial-gradient(at 50% 90%, rgba(124,198,255,0.12) 0px, transparent 55%)',
        'titanium-sheen':
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 40%, rgba(255,255,255,0) 100%)',
      },
      boxShadow: {
        ambient: '0 24px 80px -24px rgba(94,231,224,0.18)',
        float: '0 10px 40px -12px rgba(0,0,0,0.6)',
        ring: '0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        'aurora-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.8' },
          '50%': { transform: 'translate3d(2%,-3%,0) scale(1.08)', opacity: '1' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'aurora-drift': 'aurora-drift 14s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
