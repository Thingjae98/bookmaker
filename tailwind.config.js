/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Nanum Pen Script"', '"Noto Sans KR"', 'cursive'],
        body: ['"Noto Sans KR"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Consolas"', 'monospace'],
      },
      colors: {
        // KidCanvas — 따뜻한 파스텔 팔레트
        peach:   { 50: '#FFF8F5', 100: '#FFF0EB', 200: '#FFDDD2', 300: '#FFC4AD', 400: '#FFA07A', 500: '#FF8C5E', 600: '#E8734A' },
        butter:  { 50: '#FFFDF5', 100: '#FFF9E6', 200: '#FFF0C2', 300: '#FFE699', 400: '#FFD966', 500: '#FFC933' },
        mint:    { 50: '#F5FFFE', 100: '#E6FFF9', 200: '#C2FFEE', 300: '#8AEDDA', 400: '#5CD6C0', 500: '#3DBFA8' },
        sky:     { 50: '#F5FAFF', 100: '#E6F3FF', 200: '#C2E2FF', 300: '#8AC9F5', 400: '#5BB0E8', 500: '#3B96D4' },
        lavender:{ 50: '#FAF5FF', 100: '#F0E6FF', 200: '#DFC8FF', 300: '#C8A0F5', 400: '#B07AE8', 500: '#9A5CD4' },
        coral:   { 50: '#FFF5F5', 100: '#FFE6E6', 200: '#FFC8C8', 300: '#FFA0A0', 400: '#FF7A7A', 500: '#FF5C5C' },
        // Legacy aliases — 호환성
        cream: '#FFF8F5',
        warm: { 50: '#FFF8F5', 100: '#FFF0EB', 200: '#FFDDD2', 400: '#FFA07A', 600: '#E8734A', 800: '#5C3D2E' },
        ink: { 50: '#FFF8F5', 100: '#FFF0EB', 200: '#FFDDD2', 400: '#C49A87', 600: '#7A5C4F', 800: '#3D2B22', 900: '#2D1F18' },
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in': 'slideIn 0.4s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        wiggle: { '0%, 100%': { transform: 'rotate(0deg)' }, '25%': { transform: 'rotate(-3deg)' }, '75%': { transform: 'rotate(3deg)' } },
        bounceSoft: { '0%': { transform: 'scale(0.95)' }, '50%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
