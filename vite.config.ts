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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split vendor code so no single chunk exceeds ~500 kB gzipped.
            if (id.includes('recharts') || id.includes('d3') || id.includes('victory')) {
              return 'charts'
            }
            if (id.includes('pdf-lib') || id.includes('pdfmake') || id.includes('jspdf')) {
              return 'pdf'
            }
            if (id.includes('html5-qrcode') || id.includes('qr-scanner')) {
              return 'scanner'
            }
            if (id.includes('exceljs') || id.includes('sheetjs') || id.includes('xlsx')) {
              return 'excel'
            }
            if (id.includes('@base-ui') || id.includes('tw-animate-css')) {
              return 'base-ui'
            }
            if (id.includes('date-fns')) {
              return 'date-fns'
            }
            if (id.includes('dexie')) {
              return 'dexie'
            }
            if (id.includes('react-router') || id.includes('@remix-run')) {
              return 'router'
            }
            if (id.includes('react-dom')) {
              return 'react-dom'
            }
            if (id.includes('react') && !id.includes('react-dom')) {
              return 'react'
            }
            if (
              id.includes('@radix-ui') ||
              id.includes('@shadcn') ||
              id.includes('class-variance-authority') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge') ||
              id.includes('lucide-react')
            ) {
              return 'ui'
            }
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            if (id.includes('zod') || id.includes('zustand') || id.includes('@tanstack')) {
              return 'utils'
            }
            return 'vendor'
          }
        },
      },
    },
  },
})
