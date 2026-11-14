/** @type {import('tailwindcss').Config} */
// The `indigo` palette reads CSS variables whose FALLBACKS are Tailwind's own default indigo values, so the main
// app renders exactly as before. A white-label org sets --indigo-50..950 at runtime (src/branding), which recolours
// every existing `bg-indigo-600`, `text-indigo-700`, `border-indigo-200`... without editing a single page.
const indigo = (n, rgb) => `rgb(var(--indigo-${n}, ${rgb}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Hikasami', 'system-ui', 'sans-serif'],
      },
      colors: {
        indigo: {
          50: indigo(50, '238 242 255'), 100: indigo(100, '224 231 255'), 200: indigo(200, '199 210 254'),
          300: indigo(300, '165 180 252'), 400: indigo(400, '129 140 248'), 500: indigo(500, '99 102 241'),
          600: indigo(600, '79 70 229'), 700: indigo(700, '67 56 202'), 800: indigo(800, '55 48 163'),
          900: indigo(900, '49 46 129'), 950: indigo(950, '30 27 75'),
        },
      },
    },
  },
  plugins: [],
}
