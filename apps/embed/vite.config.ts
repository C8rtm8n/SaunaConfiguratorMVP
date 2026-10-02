import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2019',
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry: 'src/embed.ts', formats: ['iife'], name: 'SaunaEmbed', fileName: () => 'embed.js' },
  },
});
