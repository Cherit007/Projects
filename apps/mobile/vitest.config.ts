import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectRoot, '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@fixture-maker/domain': path.resolve(repoRoot, 'packages/domain/src'),
      '@fixture-maker/config': path.resolve(repoRoot, 'packages/config/src'),
      '@fixture-maker/api': path.resolve(repoRoot, 'packages/api/src'),
      '@fixture-maker/storage': path.resolve(repoRoot, 'packages/storage/src'),
      '@fixture-maker/analytics': path.resolve(repoRoot, 'packages/analytics/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
  },
});
