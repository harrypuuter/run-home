import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/run-home/',
  // Handle SPA routing for debug page
  server: {
    historyApiFallback: true,
  },
})
