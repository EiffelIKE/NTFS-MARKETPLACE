// The build identifier of DOC-16 (spec 14 §4): which commit a deployed bundle was built from.
import { execFileSync } from 'node:child_process'

import type { Plugin } from 'vite'

const SHORT_LENGTH = 7

export interface BuildIdSources {
  /** `process.env`; Vercel sets `VERCEL_GIT_COMMIT_SHA` for every build. */
  env: Record<string, string | undefined>
  /** The abbreviated `HEAD` of the working copy, or `undefined` outside a git checkout. */
  git: () => string | undefined
}

/** `VERCEL_GIT_COMMIT_SHA`, else the local `HEAD`, else `dev` (a tarball with no `.git`). */
export function resolveBuildId({ env, git }: BuildIdSources): string {
  const vercel = env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (vercel) return vercel.slice(0, SHORT_LENGTH)
  const head = git()?.trim()
  if (head) return head
  return 'dev'
}

export function gitShortHead(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', `--short=${String(SHORT_LENGTH)}`, 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return undefined
  }
}

/** Adds `<meta name="kurio-build">` to `index.html`, in the dev server and in the build. */
export function buildMeta(
  buildId = resolveBuildId({ env: process.env, git: gitShortHead }),
): Plugin {
  return {
    name: 'kurio:build-meta',
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { name: 'kurio-build', content: buildId }, injectTo: 'head-prepend' },
      ]
    },
  }
}
