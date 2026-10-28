/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { parseEnv } from './src/lib/env-schema.ts'

export default defineConfig(({ mode }) => {
  // Fail the build (and dev server) early on an invalid environment.
  parseEnv(loadEnv(mode, process.cwd(), 'VITE_'))

  return {
    plugins: [
      // Must run before the React plugin.
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
        quoteStyle: 'single',
        semicolons: false,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
