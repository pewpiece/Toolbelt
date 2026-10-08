module.exports = {
  preset: 'jest-expo',
  // The first React Native test in a cold transform cache (CI) can take several seconds.
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
