const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['modules/*/app.plugin.js'],
    languageOptions: { globals: { __dirname: 'readonly' } },
  },
]);
