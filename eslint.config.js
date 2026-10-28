import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import { reactRefresh } from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    'dist',
    'src/routeTree.gen.ts',
    'playwright-report',
    'test-results',
    'reports',
    '.lighthouseci',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  reactHooks.configs.flat['recommended-latest'],
  // TanStack route files export `Route` next to the component.
  reactRefresh.configs.vite({ allowExportNames: ['Route'] }),
  {
    // shadcn files export variants; route files keep their component local, and the router
    // plugin's code splitting moves it into its own module, which fast refresh handles.
    files: ['src/components/ui/**', 'src/routes/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  jsxA11y.flatConfigs.strict,
  pluginQuery.configs['flat/recommended'],
  pluginRouter.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/http/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Use the shared instance from `@/lib/http/client` (spec 00, FND-15).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Use the shared Axios instance from `@/lib/http/client` (spec 00, FND-15).',
        },
      ],
    },
  },
  prettier,
)
