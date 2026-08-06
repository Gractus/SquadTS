// eslint.config.js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import promise from 'eslint-plugin-promise';
import n from 'eslint-plugin-n';

export default defineConfig([
  {
    ignores: ['**/node_modules/*'],
    rules: {
      semi: 'error',
      'prefer-const': 'error',
      'promise/always-return': ['error', { ignoreLastCallback: true }]
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    extends: [
      js.configs.recommended,
      promise.configs['flat/recommended'],
      n.configs['flat/recommended'],
      prettier
    ]
  }
]);
