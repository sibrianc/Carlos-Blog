/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5002';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/app/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // Forward all /api and /admin calls to Flask. main.py runs on 5002 by default.
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/admin': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['src/portfolio/transmutation/__tests__/setup.ts'],
    globals: false,
  },
}));
