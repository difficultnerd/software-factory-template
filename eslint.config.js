import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      // No 'any' type (CONVENTIONS.md)
      '@typescript-eslint/no-explicit-any': 'error',

      // No unused variables (clean code)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // No console.log in src (use structured logger per CONVENTIONS.md)
      'no-console': ['error', {
        allow: ['info', 'warn', 'error'],
      }],

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Relax rules for test files
    files: ['tests/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.js'],
  },
);
