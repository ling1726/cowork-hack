import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The test host is served on 5174 and reaches the MCP server through this proxy, so requests are
// same-origin (no CORS) and carry a localhost Host/Origin that the MCP server accepts.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/mcp': 'http://localhost:3002' },
  },
});
