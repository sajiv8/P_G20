import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@rso/shared$': '<rootDir>/../backend/services/shared/src/index',
  },
  setupFilesAfterSetup: ['./helpers/test-fixtures.ts'],
  collectCoverageFrom: [
    '../backend/services/**/src/**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  testTimeout: 10000,
};

export default config;
