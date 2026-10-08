const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'node_modules/*', 'coverage/*', '.expo/*'],
  },
];
