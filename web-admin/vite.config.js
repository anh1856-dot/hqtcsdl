import { defineConfig } from 'vite';

// Relative assets + hash routing allow both Vite and a static dist-only server.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
