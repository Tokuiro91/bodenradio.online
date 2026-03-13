/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",   // пути к твоим файлам
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        boden: ['ZeroPrimeALILE', 'sans-serif'], // добавляем наш шрифт
      },
    },
  },
  plugins: [],
}