import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/portfolio-tracker/', 
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // prevents failures from your large 400KB data footprint
  }
})
