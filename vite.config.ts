import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', 'tests/e2e', 'dist', '.idea', '.git', '.cache'],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Charting libraries are heavy and used only on report/dashboard pages.
          if (id.includes('recharts') || id.includes('d3')) {
            return 'charts'
          }
          // Vendor/framework code
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
