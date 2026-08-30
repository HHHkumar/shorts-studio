import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// The browser app talks to the small local helper server (server/index.mjs)
// through these proxies, so everything looks like one origin to you.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://localhost:3030',
      '/out': 'http://localhost:3030',
    },
  },
});
