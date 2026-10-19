import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Default build: multi-file dist/ (hosted, Route A). --mode single: one self-contained HTML (Route B).
export default defineConfig(({ mode }) => ({
  base: './',
  worker: { format: 'iife' },
  plugins: mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist', emptyOutDir: true, target: 'es2022',
    assetsInlineLimit: mode === 'single' ? 1e9 : 4096, chunkSizeWarningLimit: 8000,
  },
  server: { port: 5173, host: '127.0.0.1' },
}));
