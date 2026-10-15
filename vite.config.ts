import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  build: { target: 'es2022' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['tests/**/*.test.{ts,tsx}']
  }
});
