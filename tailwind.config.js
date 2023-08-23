/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./domains/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      chocolate: "var(--chocolate)",
    },
    fontFamily: {
      pretendard: "Pretendard-Regular",
      uhbee: "UhBeeTokki",
      sans: "PartialSansKR-Regular",
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
