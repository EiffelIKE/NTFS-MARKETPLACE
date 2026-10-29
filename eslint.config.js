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

const axiosRestriction = {
  name: 'axios',
  message: 'Use the shared instance from `@/lib/http/client` (spec 00, FND-15).',
}

const lucideRestriction = {
  name: 'lucide-react',
  message: 'Use icons from @/components/icons (AGENTS.md).',
}

const socketClientRestriction = {
  name: 'socket.io-client',
  message: 'Only `src/lib/realtime` talks to Socket.IO; use its hooks (spec 03, RT-01).',
}

const socketBindingRestriction = {
  name: '@mswjs/socket.io-binding',
  message: 'The Socket.IO binding is mock-server code; keep it under `src/mocks` (spec 03).',
}

// What no app code may import, whatever else its folder restricts.
const baseRestrictions = [
  axiosRestriction,
  lucideRestriction,
  socketClientRestriction,
  socketBindingRestriction,
]

// Test files and the shared helpers the contract tests import.
const testFiles = ['src/**/*.test.ts', 'src/**/*-kit.ts']

const mocksMessage = 'Mock code is only reachable from the bootstrap (API-35).'
const mocksClientMessage = "Mocks implement the server; they don't use the client."

export default defineConfig(
  globalIgnores([
    'dist',
    'src/routeTree.gen.ts',
    'public/mockServiceWorker.js',
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
    files: ['**/*.{js,mjs}'],
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
  {
    // `throw redirect()` is TanStack Router's control flow for guards, not an error.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [
            {
              from: 'package',
              package: '@tanstack/router-core',
              name: ['Redirect', 'NotFoundError'],
            },
          ],
        },
      ],
    },
  },
  jsxA11y.flatConfigs.strict,
  pluginQuery.configs['flat/recommended'],
  pluginRouter.configs['flat/recommended'],
  {
    // Mock code is reachable only from the bootstrap's dynamic import (spec 02 §12, API-35).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/mocks/**', 'src/main.tsx', ...testFiles],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: baseRestrictions,
          patterns: [{ group: ['@/mocks', '@/mocks/*', '**/mocks/**'], message: mocksMessage }],
        },
      ],
    },
  },
  {
    files: ['src/main.tsx', ...testFiles],
    ignores: ['src/mocks/**', 'src/contracts/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: baseRestrictions }],
    },
  },
  {
    // The one folder that may import `socket.io-client`; everything else stays restricted.
    files: ['src/lib/realtime/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [axiosRestriction, lucideRestriction, socketBindingRestriction],
          patterns: [{ group: ['@/mocks', '@/mocks/*', '**/mocks/**'], message: mocksMessage }],
        },
      ],
    },
  },
  {
    files: ['src/lib/http/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [lucideRestriction, socketClientRestriction, socketBindingRestriction],
          patterns: [{ group: ['@/mocks', '@/mocks/*', '**/mocks/**'], message: mocksMessage }],
        },
      ],
    },
  },
  {
    // Contracts depend only on zod and the money module.
    files: ['src/contracts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...baseRestrictions,
            { name: 'msw', message: 'Contracts depend only on zod and money.' },
            { name: 'react', message: 'Contracts depend only on zod and money.' },
          ],
          patterns: [
            {
              // Only `@/contracts/*` and `@/lib/money` may be imported through the alias.
              regex: '^@/(?!contracts/|lib/money$)',
              message: 'Contracts depend only on zod and money.',
            },
            { group: ['../*'], message: 'Contracts depend only on zod and money.' },
          ],
        },
      ],
    },
  },
  {
    // Mocks implement the server; they never use the client.
    files: ['src/mocks/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            axiosRestriction,
            lucideRestriction,
            socketClientRestriction,
            { name: '@/api', message: mocksClientMessage },
          ],
          patterns: [
            {
              group: ['@/api/*', '@/lib/http/*', '@/features/*', '@/routes/*'],
              message: mocksClientMessage,
            },
            {
              group: ['@/lib/realtime', '@/lib/realtime/*'],
              message: "Mocks implement the server; they don't use the realtime client.",
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
  {
    // Contract tests probe the raw HTTP surface (unmatched routes, headers) next to Axios.
    files: testFiles,
    rules: { 'no-restricted-globals': 'off' },
  },
  prettier,
)
