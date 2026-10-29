// `pnpm lighthouse` (spec 13): builds the app, audits home and details in both profiles with
// Lighthouse CI (three runs each), and writes the summary.
//   node scripts/lighthouse-run.ts                    build + audit + reports/lighthouse/summary.*
//   node scripts/lighthouse-run.ts --publish          also copy the summary and the median runs to lighthouse/reports/
//   node scripts/lighthouse-run.ts --skip-build       reuse dist/
//   node scripts/lighthouse-run.ts --strict           exit 1 when a median misses the brief's targets
//   node scripts/lighthouse-run.ts --deployed <url>   audit a deployed origin instead (report only)
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

import {
  buildSummary,
  CATEGORIES,
  meetsTarget,
  PAGES,
  PROFILES,
  publish,
  RAW_DIR,
  renderMarkdown,
  writeSummary,
} from './lighthouse-summary.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const deployedIndex = args.indexOf('--deployed')
const deployed = deployedIndex === -1 ? undefined : args[deployedIndex + 1]
if (deployedIndex !== -1 && !deployed) {
  console.error('usage: node scripts/lighthouse-run.ts --deployed <https://origin>')
  process.exit(2)
}

function run(command: string, commandArgs: string[], env: NodeJS.ProcessEnv = process.env): number {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', env })
  return result.status ?? 1
}

// The same Chromium Playwright drives the E2E suite with, pinned by the lockfile, unless the caller
// brings their own (`CHROME_PATH`).
const chrome = process.env.CHROME_PATH ?? chromium.executablePath()
// The summary reads the browser version from the same binary.
process.env.CHROME_PATH = chrome
const env = process.env
console.log(`Chrome: ${chrome}`)

if (!deployed && !flag('--skip-build') && run('pnpm', ['build']) !== 0) process.exit(1)

// LHCI appends to its output folder; stale runs would be counted as runs of this audit.
const rawRoot = deployed ? path.join(RAW_DIR, 'deployed') : RAW_DIR
for (const profile of PROFILES)
  rmSync(path.join(rawRoot, profile), { recursive: true, force: true })
mkdirSync(rawRoot, { recursive: true })

for (const profile of PROFILES) {
  const lhciArgs = ['exec', 'lhci', 'autorun', `--config=lighthouse/${profile}.json`]
  if (deployed) {
    const origin = deployed.replace(/\/$/, '')
    lhciArgs.push(
      ...PAGES.map((page) => `--collect.url=${origin}${page.path}`),
      '--collect.startServerCommand=',
      `--upload.outputDir=${path.relative(root, path.join(rawRoot, profile))}`,
    )
  }
  // Targets missed make `lhci` exit 1; the reports are written either way, so keep going and let
  // the summary decide (a crashed collection leaves no reports and fails in `buildSummary`).
  run('pnpm', lhciArgs, env)
}

const summary = buildSummary(rawRoot)
writeSummary(summary, rawRoot)
console.log(`\n${renderMarkdown(summary)}`)
console.log(`Summary: ${path.relative(root, path.join(rawRoot, 'summary.md'))}`)
if (flag('--publish') && !deployed) {
  const files = publish(summary, rawRoot)
  console.log(`Published to lighthouse/reports/: ${files.join(', ')}`)
}

const missed = summary.results.flatMap((result) =>
  CATEGORIES.filter((id) => !meetsTarget(id, result.median.scores[id])).map(
    (id) => `${result.profile} ${result.page} ${id} = ${String(result.median.scores[id])}`,
  ),
)
if (missed.length > 0) {
  console.log(`\nBelow target (see lighthouse/reports/analysis.md):\n  ${missed.join('\n  ')}`)
  if (flag('--strict')) process.exit(1)
}
