const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // jest.mock factories are hoisted above imports, so they must use require().
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Node scripts and config files (CommonJS).
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', require: 'readonly', console: 'readonly' },
    },
  },
  {
    ignores: ['dist/*', 'android/*', 'node_modules/*', 'coverage/*', '.expo/*'],
  },
];
