import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves this app at https://cherit007.github.io/Projects/exam-tracker/
const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/Projects/exam-tracker/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
