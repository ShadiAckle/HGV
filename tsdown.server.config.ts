import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'server/server.ts',
  external: (id) => {
    if (id.startsWith('.') || id.startsWith('/') || id.includes('hilton-kb-chat') || id.includes('databricks_ai')) {
      return false;
    }
    return /^[^./]/.test(id) || id.includes('/node_modules/');
  },
  tsconfig: 'tsconfig.server.json',
  outExtensions: () => ({
    js: '.js',
  }),
});
