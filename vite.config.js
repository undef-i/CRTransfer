import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../data',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  base: './',
  worker: {
    format: 'es',
  },
  // 确保WASM文件被正确处理
  assetsInclude: ['**/*.wasm'],
});