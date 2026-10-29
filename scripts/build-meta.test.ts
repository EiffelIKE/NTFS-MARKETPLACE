import { describe, expect, it } from 'vitest'

import { buildMeta, resolveBuildId } from './build-meta.ts'

const git = (value: string | undefined) => () => value

describe('resolveBuildId', () => {
  it('prefers the commit Vercel built, shortened to seven characters', () => {
    const env = { VERCEL_GIT_COMMIT_SHA: 'abc123def4567890abc123def4567890abc12345' }
    expect(resolveBuildId({ env, git: git('ffffff0') })).toBe('abc123d')
  })

  it('keeps a value that is already short', () => {
    expect(resolveBuildId({ env: { VERCEL_GIT_COMMIT_SHA: 'abc123' }, git: git(undefined) })).toBe(
      'abc123',
    )
  })

  it('falls back to the local HEAD when Vercel sets nothing', () => {
    expect(resolveBuildId({ env: {}, git: git('256e569\n') })).toBe('256e569')
    expect(resolveBuildId({ env: { VERCEL_GIT_COMMIT_SHA: ' ' }, git: git('256e569') })).toBe(
      '256e569',
    )
  })

  it('is `dev` outside a git checkout', () => {
    expect(resolveBuildId({ env: {}, git: git(undefined) })).toBe('dev')
    expect(resolveBuildId({ env: {}, git: git('  ') })).toBe('dev')
  })
})

describe('buildMeta', () => {
  it('injects the identifier as <meta name="kurio-build">', () => {
    const plugin = buildMeta('abc123d')
    const hook = plugin.transformIndexHtml
    expect(typeof hook).toBe('function')
    const tags = (hook as () => unknown)()
    expect(tags).toEqual([
      {
        tag: 'meta',
        attrs: { name: 'kurio-build', content: 'abc123d' },
        injectTo: 'head-prepend',
      },
    ])
  })
})
