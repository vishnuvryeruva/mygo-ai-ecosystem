/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mygo-orange': '#FF6B35',
        'mygo-teal': '#2D7D7D',
        'heading': 'var(--text-heading)',
        'main': 'var(--text-main)',
        'muted': 'var(--text-muted)',
      },
    },
  },
  plugins: [],
}

