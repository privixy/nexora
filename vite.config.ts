import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Polyfills for browser environment (needed by wkx library)
      buffer: 'buffer',
      util: 'util',
    },
  },
  define: {
    // Make Node.js globals available in browser
    global: 'globalThis',
    'process.env': {},
  },
  build: {
    // Monaco editor ships pre-built web workers (ts.worker ~7MB, css.worker ~1MB)
    // that are loaded lazily on demand — bumping the limit accommodates them.
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor') || id.includes('node_modules/@monaco-editor/react')) return 'monaco-editor'
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/@xyflow/react') || id.includes('node_modules/dagre')) return 'xyflow'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'react-vendor'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next') || id.includes('node_modules/i18next-browser-languagedetector')) return 'i18n'
          if (id.includes('node_modules/react-markdown')) return 'markdown'
          if (id.includes('node_modules/@tanstack/react-table') || id.includes('node_modules/@tanstack/react-virtual')) return 'table'
          if (id.includes('node_modules/wkx') || id.includes('node_modules/buffer') || id.includes('node_modules/util')) return 'wkx'
        },
      },
    },
  },
})
