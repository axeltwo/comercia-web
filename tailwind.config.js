/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Verde moderado: solo para acciones positivas y estados "ok"
        brand: {
          50: '#eef7f1',
          100: '#d8ecdf',
          200: '#b3d9c2',
          500: '#2f9460',
          600: '#1f7a4d',
          700: '#196240',
          800: '#154f35',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 12px 32px -8px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
