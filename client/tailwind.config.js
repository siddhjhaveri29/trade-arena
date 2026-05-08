/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0B0E11',
        'bg-secondary': '#131722',
        'bg-card': '#1C2030',
        'bg-hover': '#242836',
        'border-color': '#2A2E39',
        'text-primary': '#D1D4DC',
        'text-secondary': '#787B86',
        'trade-green': '#26A69A',
        'trade-red': '#EF5350',
        'trade-blue': '#2196F3',
        'trade-yellow': '#FFB74D',
        'trade-accent': '#4CAF50'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    }
  },
  plugins: []
}
