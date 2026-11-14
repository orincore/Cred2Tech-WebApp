import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        // Keep the browser's Host header when testing a white-label org locally (acme.localhost:3003): the API picks
        // the organisation from it. Off by default so existing local development is unchanged.
        changeOrigin: process.env.VITE_KEEP_HOST !== '1',
      },
    },
  },
})
