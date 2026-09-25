/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00d4ff',
        'neon-magenta': '#ff006e',
        'neon-purple': '#8338ec',
        'neon-orange': '#ff7a18',
        'neon-yellow': '#ffbe0b',
        'bg-primary': '#0a0a0f',
        'bg-secondary': '#12121a',
        'bg-tertiary': '#1a1a24',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 212, 255, 0.5)',
        'neon-magenta': '0 0 20px rgba(255, 0, 110, 0.5)',
        'neon-purple': '0 0 20px rgba(131, 56, 236, 0.5)',
        'neon-orange': '0 0 20px rgba(255, 122, 24, 0.5)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      backdropBlur: {
        'glass': '10px',
      }
    },
  },
  plugins: [],
}