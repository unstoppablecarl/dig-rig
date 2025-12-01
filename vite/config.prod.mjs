import { defineConfig, mergeConfig } from 'vite';

const phasermsg = () => {
  return {
    name: 'phasermsg',
    buildStart() {
      process.stdout.write(`Building for production...\n`);
    },
    buildEnd() {
      process.stdout.write(`✨ Done ✨\n`);
    },
  };
};

const baseConfig = {
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        importers: [
          // ...
        ],
      },
    },
  },
  server: {
    port: 8081,
  },
};

export { baseConfig };

export default defineConfig(
  mergeConfig(baseConfig, {
    logLevel: 'warning',
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          passes: 2,
        },
        mangle: true,
        format: {
          comments: false,
        },
      },
    },
    plugins: [
      phasermsg(),
    ],
  })
);