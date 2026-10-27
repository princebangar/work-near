// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'android/*', 'ios/*', 'scripts/*', 'plugins/*'] },
  {
    // '@/…' alias from jsconfig.json (Metro resolves it natively)
    settings: { 'import/resolver': { typescript: { project: './jsconfig.json' } } },
    rules: {
      // The app does not use the React Compiler; screens keep the web app's hook patterns.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'import/namespace': 'off',
    },
  },
]);
