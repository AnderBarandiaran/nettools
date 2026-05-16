/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Geist', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        body:  ['Inter', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        mono:  ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
