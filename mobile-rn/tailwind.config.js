/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#1a1a2e',
        surface: '#1e2040',
        'surface-raised': '#252847',
        primary: '#6c63ff',
        gold: '#c9a227',
        'text-primary': '#f0eefc',
        'text-muted': '#8884a8',
        'border-subtle': '#2e2c4e',
      },
      fontFamily: {
        serif: ['PlayfairDisplay_700Bold', 'serif'],
        sans: ['Montserrat_400Regular', 'sans-serif'],
      },
      borderRadius: {
        sharp: '4px',
      },
    },
  },
  plugins: [],
}
