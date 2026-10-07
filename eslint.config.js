// eslint.config.js
import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier/flat'
import promise from 'eslint-plugin-promise'
import n from 'eslint-plugin-n'

export default defineConfig([
  { ignores: ['**/node_modules/*', 'dist/', 'src/core/plugins-unported/'] },
  {
    files: ['**/*.js'],
    rules: {
      'prefer-const': 'error',
      'promise/always-return': ['error', { ignoreLastCallback: true }],
      'n/no-missing-import': ['error', { ignoreTypeImport: true }],
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [
      js.configs.recommended,
      promise.configs['flat/recommended'],
      n.configs['flat/recommended'],
      prettier,
    ],
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        { allowShortCircuit: true, allowTernary: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'prefer-const': 'error',
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [js.configs.recommended, tseslint.configs.recommended, prettier],
  },
])
