/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Serif KR"', 'Georgia', 'serif'],
        body: ['"Noto Sans KR"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Consolas"', 'monospace'],
      },
      colors: {
        // Legacy aliases — 기존 에디터/주문 페이지 호환성 유지
        cream: '#FAFAFA',
        warm: { 50: '#FAFAFA', 100: '#F5F5F5', 200: '#E5E5E5', 400: '#A3A3A3', 600: '#525252', 800: '#262626' },
        ink: { 50: '#FAFAFA', 100: '#F5F5F5', 200: '#E5E5E5', 400: '#A3A3A3', 600: '#525252', 800: '#262626', 900: '#0A0A0A' },
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in': 'slideIn 0.4s ease-out forwards',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
