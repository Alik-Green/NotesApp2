import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
const browserGlobals = { window:'readonly', document:'readonly', navigator:'readonly', localStorage:'readonly', HTMLElement:'readonly', HTMLCanvasElement:'readonly', CanvasRenderingContext2D:'readonly', Navigator:'readonly', React:'readonly', requestAnimationFrame:'readonly', cancelAnimationFrame:'readonly', IntersectionObserver:'readonly', URL:'readonly', Blob:'readonly', File:'readonly', confirm:'readonly', setTimeout:'readonly', clearTimeout:'readonly' };
export default [
  { ignores: ['dist', 'node_modules', 'release', 'coverage'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } }, globals: browserGlobals },
    plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': reactHooks },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },
  { files: ['electron/**/*.cjs'], languageOptions: { globals: { require:'readonly', module:'readonly', __dirname:'readonly', process:'readonly' } }, rules: { 'no-undef':'off' } }
];
