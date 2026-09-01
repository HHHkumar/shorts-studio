import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Vite prints "We recommend switching to @vitejs/plugin-react for improved
// performance" on every start. Ignore it - we cannot take that advice.
//
// @vitejs/plugin-react pulls @rolldown/plugin-babel, which wants Babel 8.
// Remotion's toolchain pins Babel 7 (through @svgr and
// @babel/helper-module-transforms), and npm refuses to resolve both. Installing
// it needs --legacy-peer-deps, which would leave Remotion running against a
// Babel it was not built for - to save a few milliseconds on a dev server that
// already starts in under half a second.
//
// Re-check when Remotion moves to Babel 8. Until then the warning is cosmetic.

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
