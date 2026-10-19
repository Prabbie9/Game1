import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig(({ mode }) => ({
  root: __dirname, base: './',
  publicDir: mode === 'single' ? false : 'public',
  worker: { format: 'iife' },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', emptyOutDir: true, assetsInlineLimit: mode === 'single' ? 100000000 : 4096 },
}));
