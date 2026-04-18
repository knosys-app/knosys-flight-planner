import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function inlineAssetsAsBase64() {
  const virtualPrefix = '\0virtual:b64:';
  return {
    name: 'inline-assets-as-base64',
    enforce: 'pre' as const,
    async resolveId(this: any, id: string, importer: string | undefined) {
      if (!id.endsWith('?b64')) return null;
      const bareId = id.slice(0, -4);
      const resolved = await this.resolve(bareId, importer, { skipSelf: true });
      if (!resolved) return null;
      return virtualPrefix + resolved.id;
    },
    load(id: string) {
      if (!id.startsWith(virtualPrefix)) return null;
      const realPath = id.slice(virtualPrefix.length);
      const bytes = fs.readFileSync(realPath);
      return `export default ${JSON.stringify(bytes.toString('base64'))};`;
    },
  };
}

function concatMaplibreCss() {
  return {
    name: 'concat-maplibre-css',
    closeBundle() {
      const outFile = path.resolve(__dirname, 'styles.css');
      const maplibreCssPath = path.resolve(
        __dirname,
        'node_modules/maplibre-gl/dist/maplibre-gl.css',
      );
      const pluginCssPath = path.resolve(__dirname, 'src/styles.css');
      const parts: string[] = [];
      if (fs.existsSync(maplibreCssPath)) {
        parts.push('/* maplibre-gl.css */\n' + fs.readFileSync(maplibreCssPath, 'utf8'));
      }
      if (fs.existsSync(pluginCssPath)) {
        parts.push('/* plugin styles */\n' + fs.readFileSync(pluginCssPath, 'utf8'));
      }
      fs.writeFileSync(outFile, parts.join('\n\n'));
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineAssetsAsBase64(), concatMaplibreCss()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.tsx'),
      name: 'KnosysFlightPlanner',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'React',
        },
        inlineDynamicImports: true,
      },
    },
    outDir: '.',
    emptyOutDir: false,
    cssCodeSplit: false,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
