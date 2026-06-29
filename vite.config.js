import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/portfolio-tracker/', // <-- CRITICAL: This must match your GitHub repository name exactly!
})
