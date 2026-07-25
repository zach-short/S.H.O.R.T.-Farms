import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cesiumBuild = path.join(path.dirname(require.resolve('cesium')), 'Build/Cesium');

// Directories Cesium fetches at runtime from CESIUM_BASE_URL. They live in
// node_modules, so they have to be served in dev and copied on build.
const CESIUM_STATIC_DIRS = ['Workers', 'Assets', 'ThirdParty', 'Widgets'];
const CESIUM_BASE = '/cesium/';

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ktx2': 'image/ktx2',
  '.xml': 'application/xml',
};

/**
 * Serves node_modules/cesium/Build/Cesium/{Workers,Assets,ThirdParty,Widgets}
 * at /cesium/ in dev, and copies them into the bundle on build.
 *
 * Written inline rather than via vite-plugin-static-copy: that plugin derives
 * the destination from the source path *relative to the vite root*, so an
 * absolute node_modules source lands under /cesium/node_modules/cesium/Build/…
 * instead of /cesium/. Cesium then gets the SPA fallback HTML where it expects
 * an image and fails with "The source image could not be decoded".
 */
function cesiumStatic(): Plugin {
  return {
    name: 'cesium-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(CESIUM_BASE)) return next();

        const rel = decodeURIComponent(req.url.slice(CESIUM_BASE.length).split('?')[0]);
        const file = path.resolve(cesiumBuild, rel);

        // Reject traversal outside the Cesium build directory.
        if (!file.startsWith(cesiumBuild + path.sep)) return next();
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();

        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve('dist');
      await Promise.all(
        CESIUM_STATIC_DIRS.map((dir) =>
          fsp.cp(path.join(cesiumBuild, dir), path.join(outDir, 'cesium', dir), {
            recursive: true,
            dereference: true,
          }),
        ),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cesiumStatic()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'cesium', test: /node_modules[\\/]cesium[\\/]/ }],
        },
      },
    },
  },
});
