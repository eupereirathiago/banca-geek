import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Sanitize process.env to remove any invalid environment variable names with punctuation injected by modal UI
for (const key of Object.keys(process.env)) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    delete process.env[key];
  }
}

export default defineConfig(() => {
  for (const key of Object.keys(process.env)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      delete process.env[key];
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
