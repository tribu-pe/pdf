import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  clean: true,
  // package.json "exports" points to .js; the package is "type": "module", so .js is ESM.
  fixedExtension: false,
});
