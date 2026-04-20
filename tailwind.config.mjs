/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        paper: '#fafaf7',
        electric: '#00ff88',
        ember: '#ff5e3a',
        graphite: '#1a1a1a',
        muted: '#6b6b6b',
        signal: '#ffd60a',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Menlo"', 'monospace'],
        display: ['"Fraunces"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
