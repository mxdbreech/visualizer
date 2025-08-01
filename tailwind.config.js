/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      'satoshi': ['Satoshi', 'sans-serif']
    },
    extend: {
      colors: {
        'mxd': '#1F1930',
        'primary': '#53CFB9'
      }
    },
  },
  plugins: [],
}