import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bangalore-eating-game/',
  build: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
});
