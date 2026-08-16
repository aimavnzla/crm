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
        aima: {
          bg: '#0f0a1a',
          bgCard: '#1a1230',
          border: '#2d1b4e',
          primary: '#7c3aed',
          primaryHover: '#a855f7',
          text: '#f3f0fa',
          textMuted: '#9a8ab8',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'aima-sm': '0 1px 2px 0 rgba(124, 58, 237, 0.08)',
        'aima-md': '0 4px 6px -1px rgba(124, 58, 237, 0.12), 0 2px 4px -2px rgba(124, 58, 237, 0.08)',
        'aima-lg': '0 10px 15px -3px rgba(124, 58, 237, 0.16), 0 4px 6px -4px rgba(124, 58, 237, 0.1)',
        'aima-glow': '0 0 40px rgba(124, 58, 237, 0.15)',
      },
      backgroundImage: {
        'aima-glow': 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124, 58, 237, 0.12) 0%, transparent 70%)',
        'aima-card-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
    },
  },
  plugins: [],
}