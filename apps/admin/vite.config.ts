import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  server: { port: 5174 },
});
