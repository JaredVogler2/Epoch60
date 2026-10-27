import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'docs/screenshots'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Determinism guard: the engine may never use wall-clock time or unseeded randomness.
      'no-restricted-globals': 'off',
    },
  },
  {
    // three.js objects are mutated imperatively inside useFrame/useMemo by design (React Three Fiber), and the
    // render layer deliberately reads a mutable external store. React-compiler purity rules do not apply here.
    files: ['src/render/**/*.{ts,tsx}'],
    rules: { 'react-hooks/immutability': 'off', 'react-hooks/refs': 'off' },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Engine must use the seeded PRNG.' },
        { object: 'Date', property: 'now', message: 'Engine must not read wall-clock time.' },
        { object: 'performance', property: 'now', message: 'Engine must not read wall-clock time.' },
      ],
    },
  },
);
