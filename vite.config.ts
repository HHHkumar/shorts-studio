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
    // Deterministic, because the helper opens the browser at this exact address
    // once it is listening. Left to drift, Vite would quietly move to 5174 when
    // 5173 was busy and the helper would open a page that is not there.
    strictPort: true,
    // NOT opened here. Vite is ready in under half a second while node is still
    // loading the helper, so opening from this side raced the browser to a
    // server that did not exist yet and greeted people with connection errors.
    open: false,
    proxy: {
      '/api': 'http://localhost:3030',
      '/out': 'http://localhost:3030',
    },
  },
});
