import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', 'examples/static-chat/vendor/**'],
  },
  js.configs.recommended,
  {
    // Everything in this repository is plain JavaScript that runs either in a
    // browser without a build step or in Node as a script. There is no
    // TypeScript here: the SDK itself lives in the private monorepo and reaches
    // this repository only as a compiled bundle.
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
];
