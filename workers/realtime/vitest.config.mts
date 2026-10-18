import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: { include: ['test/**/*.test.ts'] },
});
