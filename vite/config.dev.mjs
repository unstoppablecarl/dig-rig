import { defineConfig, mergeConfig } from 'vite';
import { baseConfig } from './config.prod.mjs';

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  })
);