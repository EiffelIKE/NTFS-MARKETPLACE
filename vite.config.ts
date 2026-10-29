/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

import { buildMeta } from './scripts/build-meta.ts'
import { devRoutesEnabled, stripDevRoutes } from './scripts/dev-routes.ts'
import { parseEnv } from './src/lib/env-schema.ts'

/**
 * Preloads what the first paint needs but the HTML cannot name (spec 13 §4): the Latin subset of
 * the self-hosted font, which the browser would otherwise find only after the CSS, and the mock
 * chunk with its own dependencies, which `main.tsx` imports dynamically so the shell can render
 * without it. Emitted only in the production build, where the hashed file names exist.
 */
function preloadCriticalAssets(): Plugin {
  return {
    name: 'kurio:preload-critical-assets',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        if (!bundle) return
        const tags: HtmlTagDescriptor[] = []

        const font = Object.keys(bundle).find((file) =>
          /roboto-mono-latin-wght-normal-[\w-]+\.woff2$/.test(file),
        )
        if (font) {
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
              href: `/${font}`,
            },
            injectTo: 'head',
          })
        }

        const chunks = Object.values(bundle).filter((output) => output.type === 'chunk')
        const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
        const entry = chunks.find((chunk) => chunk.isEntry)
        const mocks = chunks.find((chunk) =>
          chunk.facadeModuleId?.endsWith('/src/mocks/browser.ts'),
        )
        if (entry && mocks) {
          const collect = (start: string, into = new Set<string>()) => {
            if (into.has(start)) return into
            into.add(start)
            for (const next of byName.get(start)?.imports ?? []) collect(next, into)
            return into
          }
          const already = collect(entry.fileName)
          for (const file of collect(mocks.fileName)) {
            if (already.has(file)) continue
            tags.push({
              tag: 'link',
              attrs: { rel: 'modulepreload', crossorigin: '', href: `/${file}` },
              injectTo: 'head',
            })
          }
        }
        return tags
      },
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const rawEnv = loadEnv(mode, process.cwd(), 'VITE_')
  // Fail the build (and dev server) early on an invalid environment.
  const env = parseEnv(rawEnv)
  // Build-time only, so it is not part of the client's env schema: the `/dev/*` harnesses are
  // reachable in the dev server, and in a build only when asked for (spec 14 §9, R10).
  const devRoutes = devRoutesEnabled(command, rawEnv.VITE_ENABLE_DEV_ROUTES)

  return {
    plugins: [
      // Before the router plugin, so a disabled `/dev/*` route is replaced before it is split.
      stripDevRoutes(devRoutes),
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
      preloadCriticalAssets(),
      buildMeta(),
      tailwindcss(),
      // Figma SVGs as React components; icons are decorative unless a caller labels the control.
      svgr({
        include: '**/*.svg?react',
        svgrOptions: { icon: true, svgProps: { 'aria-hidden': 'true', focusable: 'false' } },
      }),
    ],
    // Write the parsed flag back so its default also applies here: `main.tsx` then compares a
    // literal, and with `VITE_ENABLE_MOCKS=false` Rollup drops the whole mocks/ chunk (spec 02 §3).
    define: {
      'import.meta.env.VITE_ENABLE_MOCKS': JSON.stringify(String(env.VITE_ENABLE_MOCKS)),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // msw's cookie jar (tough-cookie) bundles tldts' public-suffix list, 267 kB of the mock
        // chunk. `tldts-experimental` is the same API and the same list in a more compact encoding,
        // so cookie handling is unchanged and the mock chunk drops by about a third (spec 13 §4).
        tldts: 'tldts-experimental',
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Stable vendor chunks (spec 13 §4): framework code changes rarely, so it stays cached
          // across releases and the entry chunk only holds app code.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'tanstack',
                test: /node_modules[\\/]@tanstack[\\/](react-router|router-core|history|react-query|query-core|store|react-store)[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'node',
      // Contract tests call the real Axios client against `msw/node`, which needs an absolute URL.
      env: { VITE_API_BASE_URL: 'http://api.test/api' },
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
      // Vitest blanks CSS by default; `?raw` imports (token tests) need the real file contents.
      css: { include: [/\.css\?raw$/] },
    },
  }
})
