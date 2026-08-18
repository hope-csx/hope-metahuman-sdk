import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'examples/static-chat/vendor/**',
      'examples/react-native/**/*.{ts,tsx}',
    ],
  },
  js.configs.recommended,
  {
    // Repository tooling and the static example are plain JavaScript. The
    // React Native example is TypeScript and is checked by its Expo project.
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
