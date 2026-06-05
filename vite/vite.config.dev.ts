import { defineConfig, mergeConfig } from 'vite';
import { baseConfig } from './vite.config.prod.js';

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [
    ],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  })
);