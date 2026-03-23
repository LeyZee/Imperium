/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        marble: {
          50: '#faf9f6',
          100: '#f5f3ef',
          200: '#edeae4',
          300: '#ddd8cf',
        },
        navy: {
          DEFAULT: '#1b2e4b',
          light: '#243a5e',
          dark: '#142338',
          50: 'rgba(27, 46, 75, 0.05)',
          100: 'rgba(27, 46, 75, 0.08)',
          200: 'rgba(27, 46, 75, 0.15)',
        },
        accent: {
          DEFAULT: '#f5b731',
          light: '#fcd34d',
          dark: '#d4990a',
          dim: 'rgba(245, 183, 49, 0.1)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Cinzel', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease',
        'slide-up': 'slideUp 0.4s ease',
        'float-in': 'floatIn 0.25s ease',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-12px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
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
