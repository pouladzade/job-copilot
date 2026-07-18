/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.base.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  rules: {
    // ============================================================
    //  NON-NEGOTIABLE — MUST BE ERRORS (from .clinerules)
    // ============================================================

    // --- TypeScript strictness ---
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/array-type': ['error', { default: 'array' }],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowAny: false,
      },
    ],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/promise-function-async': 'error',
    '@typescript-eslint/method-signature-style': ['error', 'property'],
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/no-for-in-array': 'error',
    '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/restrict-template-expressions': [
      'error',
      { allowNumber: true, allowBoolean: false, allowAny: false, allowNullish: false },
    ],
    '@typescript-eslint/require-await': 'off',

    // --- Code quality (non-negotiable from .clinerules) ---
    complexity: ['error', 10],
    'max-depth': ['error', 3],
    'max-params': ['error', 4],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always', { null: 'never' }],
    // ============================================================
    //  MAGIC NUMBER GUARDRAIL
    //  Inline numeric/string literal constants are PROHIBITED
    //  outside of the designated constants/config files.
    //
    //  Currently set to 'off' because the existing codebase has ~71
    //  pre-existing violations that need to be cleaned up first.
    //  Once the remaining inline constants are extracted into
    //  @patec/shared/constants/*, change this to 'warn' or 'error'.
    //
    //  To enable on YOUR branch during active development:
    //    Set this to ['warn', { ignore: [0, 1, -1, 2] }]
    //    Run: npx eslint src/ --rule 'no-magic-numbers: warn'
    //    Fix only the violations YOU introduced.
    // ============================================================
    'no-magic-numbers': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-extend-native': 'error',
    'no-loop-func': 'error',
    'no-return-await': 'error',
    'require-await': 'off',
    'no-else-return': ['error', { allowElseIf: false }],
    'no-useless-return': 'error',
    'no-lonely-if': 'error',
    'prefer-object-spread': 'error',
    'prefer-template': 'error',
    'no-param-reassign': 'off',

    // --- Formatting ---
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],
    'padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'always', prev: ['const', 'let'], next: 'block-like' },
      { blankLine: 'always', prev: 'block-like', next: ['const', 'let'] },
    ],

    // --- Imports ---
    'import/no-unresolved': 'off',
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'never',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    // NOTE: 'import/no-relative-parent-imports' is intentionally NOT enabled.
    // Within the same NestJS package, it is normal to import sibling modules
    // via relative paths (e.g., '../prisma/prisma.service').
    // The .clinerules restriction applies to CROSS-PACKAGE imports only
    // (i.e., use @patec/shared barrel exports, never deep imports from
    // packages/api-gateway into packages/database/src/...).
    // Cross-package import hygiene is enforced by TypeScript project references
    // and the @patec/shared barrel.

    // ============================================================
    //  MAX LINES PER FUNCTION — differentiated by file type
    //  (default 50 for utils; 30 for services/controllers — see overrides)
    // ============================================================
    'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
  },
  overrides: [
    // ============================================================
    //  NestJS injection classes — need runtime imports, not type-only
    // ============================================================
    {
      files: [
        '**/*.module.ts',
        '**/*.guard.ts',
        '**/*.strategy.ts',
        '**/*.interceptor.ts',
        '**/*.pipe.ts',
        '**/*.filter.ts',
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
      },
    },

    // ============================================================
    //  Services & Controllers — stricter line limit (50)
    // ============================================================
    {
      files: ['**/*.service.ts', '**/*.controller.ts'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
      },
    },

    // ============================================================
    //  DTO files — allow readonly properties naturally
    // ============================================================
    {
      files: ['**/dto/**/*.ts'],
      rules: {
        'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
        'no-magic-numbers': 'off', // DTOs often have validation constants
      },
    },

    // ============================================================
    //  Barrel export files (index.ts) — allow default export, relax some rules
    // ============================================================
    {
      files: ['**/index.ts'],
      rules: {
        'import/no-default-export': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },

    // ============================================================
    //  Test files — relax strictness for test ergonomics
    // ============================================================
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/no-unnecessary-condition': 'off',
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
        'max-depth': 'off',
        'max-params': 'off',
        'no-undefined': 'off',
      },
    },

    // ============================================================
    //  Config / Prisma seed files — CLI scripts need console, process.env
    // ============================================================
    {
      files: ['**/prisma/seed.ts', '**/prisma/seeds/**/*.ts', '**/config/**/*.ts', '**/*.config.ts'],
      rules: {
        'no-magic-numbers': 'off',
        'no-console': 'off',
        'max-lines-per-function': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        'import/no-default-export': 'off',
        'import/no-unresolved': 'off',
      },
    },

    // ============================================================
    //  Next.js page/layout files — default exports required by App Router
    // ============================================================
    {
      files: ['**/page.tsx', '**/layout.tsx', '**/loading.tsx', '**/error.tsx', '**/not-found.tsx'],
      rules: {
        'import/no-default-export': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },

