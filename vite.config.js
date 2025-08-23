import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: 'src',
  publicDir: '../data',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        vanilla: resolve(__dirname, 'src/vanilla/index.html'),
      },
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
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      './wasm/pkg': resolve(__dirname, 'src/wasm/pkg'),
    },
  },
});