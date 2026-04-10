import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // ── 型別安全：禁止 any（逐步收緊）─────────────────
      '@typescript-eslint/no-explicit-any': 'error',        // 強制落實型別安全
      '@typescript-eslint/no-unsafe-assignment': 'off',     // 太嚴格，先關
      '@typescript-eslint/no-unsafe-member-access': 'off',

      // ── Import 排序 ─────────────────────────────────────
      'sort-imports': ['warn', {
        ignoreCase: true,
        ignoreDeclarationSort: true,   // 只排序同一 group 內的 specifiers
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      }],

      // ── 一般品質 ───────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // 測試和腳本較寬鬆
    files: ['src/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
