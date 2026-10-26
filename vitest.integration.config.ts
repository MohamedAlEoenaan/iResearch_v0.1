import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: '.env.test', override: true });
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error(
    'Integration tests require DATABASE_URL pointing to a separate *_test database. Configure .env.test.',
  );
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
