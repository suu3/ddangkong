/** @type {import('tailwindcss').Config} */

//https://poiemaweb.com/tailwind
module.exports = {
  content: [
    './domains/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      chocolate07: 'var(--chocolate07, #3d3131)',
      chocolate06: 'var(--chocolate06, #493b3b)',
      chocolate05: 'var(--chocolate05, #5a4949)',
      milkChocolate: 'var(--milk-chocolate, #655049)',
      white: '#fff',
    },
    fontFamily: {
      pretendard: 'Pretendard-Regular',
      uhbee: 'UhBeeTokki',
      uhBeeSeulvely: 'UhBeeSeulvely',
      sans: 'PartialSansKR-Regular',
    },
    extend: {
      // backgroundImage: {
      //   'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      //   'gradient-conic':
      //     'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      // },
    },
  },
  plugins: [],
};
