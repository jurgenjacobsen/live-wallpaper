import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'go/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/plane-api': {
        target: 'https://api.plane.so',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/plane-api/, ''),
      },
    },
  },
})
