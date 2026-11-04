import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/auth.ts',
        'src/lib/tokens.ts',
        'src/lib/rate-limit.ts',
        'src/lib/email.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
      },
    },
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
