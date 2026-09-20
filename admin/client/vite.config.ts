import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { copyMermaidAssets, serveMermaidAssets } from '../../src/lib/mermaid-assets';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  plugins: [{
    name: 'aier-mermaid-assets',
    async configureServer(server) { await serveMermaidAssets(server.middlewares); },
    async writeBundle() { await copyMermaidAssets(fileURLToPath(new URL('./dist', import.meta.url))); },
  }],
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
