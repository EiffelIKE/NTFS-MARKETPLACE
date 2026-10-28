/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import svgr from 'vite-plugin-svgr'

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
      // Figma SVGs as React components; icons are decorative unless a caller labels the control.
      svgr({
        include: '**/*.svg?react',
        svgrOptions: { icon: true, svgProps: { 'aria-hidden': 'true', focusable: 'false' } },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      // Vitest blanks CSS by default; `?raw` imports (token tests) need the real file contents.
      css: { include: [/\.css\?raw$/] },
    },
  }
})
