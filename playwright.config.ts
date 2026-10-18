import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 375, height: 812 },
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `pnpm exec wrangler dev --config workers/realtime/wrangler.jsonc --env local --port 8787 --persist-to "${join(tmpdir(), 'ddangkong-e2e-' + randomUUID())}"`,
          url: 'http://localhost:8787/health',
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
        {
          command: 'pnpm exec next dev --port 3000',
          url: 'http://localhost:3000',
          env: { NEXT_PUBLIC_REALTIME_API_URL: 'http://localhost:8787' },
          reuseExistingServer: false,
          timeout: 120000,
        },
      ],
});
