// Let node import the app's own TypeScript the way Vite does.
//
// Node strips types on its own now, but it will not guess an extension: the app
// writes `from './types'`, and node looks for a file called exactly that. This
// adds the one rule Vite applies and node does not.
//
// Deliberately narrow. It only ever rewrites a relative specifier that resolves
// to a real .ts/.tsx file OUTSIDE node_modules - the first version tried .js
// too and caught CommonJS requires inside Remotion, which then failed to load.
// Anything it does not recognise is passed straight through untouched.
//
// Only for tools and checks that want to exercise the real app modules rather
// than a copy of their logic. Nothing in the shipped server or app needs it.
//
//   node --import ./tools/ts-resolve.mjs your-script.mjs

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL || '';
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    const bare = !/\.[a-z]+$/i.test(specifier);

    if (relative && bare && !parent.includes('/node_modules/')) {
      const base = new URL(specifier, parent);
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        if (existsSync(fileURLToPath(new URL(base.href + ext)))) {
          return next(base.href + ext, context);
        }
      }
    }

    return next(specifier, context);
  },
});
