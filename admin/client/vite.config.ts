import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE'
          && /node_modules[\\/]react-router/.test(warning.id ?? '')
        ) return;
        warn(warning);
      },
      output: {
        manualChunks: {
          editor: ['codemirror', '@codemirror/lang-markdown'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 4322,
    proxy: {
      '/api': 'http://localhost:4310',
    },
  },
});