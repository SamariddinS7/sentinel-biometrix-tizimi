import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
        watch: {
          // Exclude large Python package directories to avoid ENOSPC (file watcher limit)
          ignored: [
            '**/.pythonlibs/**',
            '**/node_modules/**',
            '**/models/**',
            '**/.git/**',
          ],
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
