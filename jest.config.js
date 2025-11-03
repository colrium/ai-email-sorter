/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.stories.{js,jsx,ts,tsx}',
        '!src/**/__tests__/**',
        '!src/app/**', // Exclude Next.js app directory for now (needs integration tests)
        '!src/components/**', // Exclude components for now (needs component tests)
    ],
    coverageThreshold: {
        './src/lib/utils/**/*.ts': {
            branches: 50, // Accounts for error handling branches that are hard to test
            functions: 90,
            lines: 73,
            statements: 73,
        },
    },
    testMatch: [
        '<rootDir>/tests/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/tests/**/*.spec.{js,jsx,ts,tsx}',
    ],
    testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/'],
    transformIgnorePatterns: [
        'node_modules/(?!(bullmq|msgpackr|@msgpackr|ioredis)/)',
    ],
    modulePathIgnorePatterns: ['<rootDir>/.next/'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
