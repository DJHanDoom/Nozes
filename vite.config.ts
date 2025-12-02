import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths to ensure assets load correctly on GitHub Pages subdirectories (e.g. /Nozes/)
  base: './',
})