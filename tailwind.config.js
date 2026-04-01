/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Serif KR"', 'Georgia', 'serif'],
        body: ['"Pretendard"', '"Noto Sans KR"', 'sans-serif'],
      },
      colors: {
        cream: '#FAF7F2',
        warm: { 50: '#FDF8F0', 100: '#F9EDDA', 200: '#F0D9B5', 400: '#D4A574', 600: '#B07D4F', 800: '#7A5230' },
        ink: { 50: '#F5F5F4', 100: '#E7E5E4', 200: '#D6D3D1', 400: '#A8A29E', 600: '#57534E', 800: '#292524', 900: '#1C1917' },
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
