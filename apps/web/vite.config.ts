import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Local aliases
      '@': path.resolve(__dirname, 'src'),

      // Shared types package
      '@sentinel/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),

      // Redirect all ../types and ./types imports to shared-types
      '../types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      './types':  path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),

      // Frontend components import services/lib from the api workspace
      // Three patterns cover all nesting depths (src/, components/, components/soc/)
      '../../services': path.resolve(__dirname, '../api/src/services'),
      '../services':    path.resolve(__dirname, '../api/src/services'),
      './services':     path.resolve(__dirname, '../api/src/services'),
      '../lib':         path.resolve(__dirname, '../api/src/lib'),
    },
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
    watch: {
      ignored: [
        '**/.pythonlibs/**',
        '**/node_modules/**',
        '**/models/**',
        '**/.git/**',
      ],
    },
  },
});
