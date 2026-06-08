/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        reef: {
          healthy: '#22c55e',
          watch: '#f97316',
          warning: '#ef4444',
          nodata: '#6b7280',
        },
      },
    },
  },
  plugins: [],
}
