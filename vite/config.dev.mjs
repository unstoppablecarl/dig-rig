import { defineConfig, mergeConfig } from 'vite';
import { baseConfig } from './config.prod.mjs';

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [],
  })
);