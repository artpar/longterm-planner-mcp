import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
