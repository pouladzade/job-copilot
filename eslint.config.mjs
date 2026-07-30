import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      '.output/',
      '.wxt/',
      'node_modules/',
      'coverage/',
      '*.cjs',
      '*.config.*',
      'entrypoints/**',
      'scripts/**',
      'src/__tests__/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Allow console.warn and console.error (app-level logging)
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Disallow debugger, alert, eval
      'no-alert': 'error',
      'no-eval': 'error',
      'no-debugger': 'error',

      // Unused vars — allow prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Chrome extension APIs use callback pattern (not await/Promises)
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',

      // Relax for existing codebase
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-useless-assignment': 'off',
    },
  },
);
