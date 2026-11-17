import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file per view (MCP App resources load no external assets).
// scripts/build.ts runs this once per view with VIEW set: singlefile inlines dynamic imports,
// which Rollup does not allow with several inputs in one build.
const root = fileURLToPath(new URL('./src/entries', import.meta.url));
const view = process.env.VIEW ?? 'alert-card';

export default defineConfig({
  root,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: false,
    rollupOptions: { input: join(root, `${view}.html`) },
  },
});
