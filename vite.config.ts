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
    // Inline all CSS into a single file so lazy route CSS does not force the
    // landing page to load the Vite preload helper (and its containing chunk).
    cssCodeSplit: false,
    // Disable automatic modulepreload on the landing page: only fetch chunks
    // when a route actually needs them, reducing first-load JS.
    modulePreload: false,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        landing: path.resolve(__dirname, 'landing.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split vendor code so no single chunk exceeds ~500 kB gzipped.
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
            // Let remaining node_modules be split naturally by their importing
            // route chunks instead of being pulled into a shared vendor chunk.
            return undefined
          }
        },
      },
    },
  },
})
