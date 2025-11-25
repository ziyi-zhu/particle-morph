import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Set base path for GitHub Pages deployment
      // Change this to match your repo name: '/<repo-name>/'
      // For root domain deployment, use '/'
      base: process.env.NODE_ENV === 'production' ? '/particle-morph/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        // Optimize for GitHub Pages
        rollupOptions: {
          output: {
            manualChunks: {
              'three': ['three'],
              'react-vendor': ['react', 'react-dom']
            }
          }
        }
      }
    };
});
