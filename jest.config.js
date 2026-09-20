module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverageFrom: ['js/**/*.js'],
    coverageReporters: ['text', 'lcov']
};
