// Turns the raw LHCI output (`reports/lighthouse/<profile>/`) into the audit deliverable (spec 13):
// per page and profile, the median of each category and metric over the runs, the runs behind
// them, the representative report, the tool versions and the execution conditions.
//   node scripts/lighthouse-summary.ts            writes reports/lighthouse/summary.{md,json}
//   node scripts/lighthouse-summary.ts --publish  also copies it to lighthouse/reports/
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const
export type CategoryId = (typeof CATEGORIES)[number]
export const METRICS = [
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
  'first-contentful-paint',
  'speed-index',
] as const
export type MetricId = (typeof METRICS)[number]

/** The brief's targets (§10), and the reference thresholds for the Core Web Vitals (PERF-05/06). */
export const SCORE_TARGETS: Record<CategoryId, number> = {
  performance: 90,
  accessibility: 95,
  'best-practices': 95,
  seo: 90,
}
export const METRIC_THRESHOLDS: Partial<Record<MetricId, number>> = {
  'largest-contentful-paint': 2500,
  'cumulative-layout-shift': 0.1,
  'total-blocking-time': 200,
}

export const PAGES = [
  { id: 'home', path: '/' },
  { id: 'details', path: '/nfts/emerald-ape-042' },
] as const
export type PageId = (typeof PAGES)[number]['id']
export const PROFILES = ['mobile', 'desktop'] as const
export type Profile = (typeof PROFILES)[number]

/** The slice of a Lighthouse result this script reads. */
export interface LhrLike {
  lighthouseVersion: string
  finalDisplayedUrl: string
  fetchTime: string
  userAgent: string
  environment: { hostUserAgent: string; networkUserAgent: string; benchmarkIndex: number }
  configSettings: {
    formFactor: string
    throttlingMethod: string
    throttling: Record<string, number>
    screenEmulation: { width: number; height: number; deviceScaleFactor: number; mobile: boolean }
  }
  categories: Record<string, { score: number | null }>
  audits: Record<
    string,
    { numericValue?: number; details?: { items?: { name: string; duration?: number }[] } }
  >
}

export interface RunResult {
  file: string
  scores: Record<CategoryId, number>
  metrics: Record<MetricId, number>
  /** `kurio:*` User Timing measures in ms (the mock layer's boot cost, PERF-13). */
  timings: Record<string, number>
}

export interface PageResult {
  page: PageId
  url: string
  profile: Profile
  runs: RunResult[]
  median: { scores: Record<CategoryId, number>; metrics: Record<MetricId, number> }
  medianTimings: Record<string, number>
  /** The run closest to the median performance score; its HTML and JSON are published. */
  representative: string
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of no values')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? Number.NaN
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? Number.NaN) + upper) / 2
}

/** Scores as whole numbers (0–100), the way Lighthouse shows them. */
export function readRun(file: string, lhr: LhrLike): RunResult {
  const scores = Object.fromEntries(
    CATEGORIES.map((id) => [id, Math.round((lhr.categories[id]?.score ?? 0) * 100)]),
  ) as Record<CategoryId, number>
  const metrics = Object.fromEntries(
    METRICS.map((id) => [id, lhr.audits[id]?.numericValue ?? Number.NaN]),
  ) as Record<MetricId, number>
  const timings: Record<string, number> = {}
  for (const item of lhr.audits['user-timings']?.details?.items ?? []) {
    if (item.name.startsWith('kurio:') && item.duration !== undefined) {
      timings[item.name] = item.duration
    }
  }
  return { file, scores, metrics, timings }
}

export function summarizePage(
  page: PageId,
  url: string,
  profile: Profile,
  runs: RunResult[],
): PageResult {
  const scores = Object.fromEntries(
    CATEGORIES.map((id) => [id, median(runs.map((run) => run.scores[id]))]),
  ) as Record<CategoryId, number>
  const metrics = Object.fromEntries(
    METRICS.map((id) => [id, median(runs.map((run) => run.metrics[id]))]),
  ) as Record<MetricId, number>
  const names = new Set(runs.flatMap((run) => Object.keys(run.timings)))
  const medianTimings = Object.fromEntries(
    [...names].map((name) => [name, median(runs.flatMap((run) => run.timings[name] ?? []))]),
  )
  // The run whose performance score and LCP are closest to the medians stands for the group.
  const distance = (run: RunResult) =>
    Math.abs(run.scores.performance - scores.performance) * 1000 +
    Math.abs(run.metrics['largest-contentful-paint'] - metrics['largest-contentful-paint'])
  const [representative] = [...runs].sort((a, b) => distance(a) - distance(b))
  if (!representative) throw new Error(`no runs for ${page} ${profile}`)
  return {
    page,
    url,
    profile,
    runs,
    median: { scores, metrics },
    medianTimings,
    representative: representative.file,
  }
}

export function meetsTarget(id: CategoryId, score: number): boolean {
  return score >= SCORE_TARGETS[id]
}

export interface Environment {
  generatedAt: string
  lighthouse: string
  lhci: string
  chrome: string
  hostUserAgent: string
  benchmarkIndex: number
  node: string
  os: string
  cpu: string
  cpuCount: number
  memoryGb: number
  commit: string
  profiles: Record<
    Profile,
    {
      formFactor: string
      throttlingMethod: string
      throttling: Record<string, number>
      screen: string
    }
  >
}

export interface Summary {
  environment: Environment
  conditions: string[]
  results: PageResult[]
}

const fmtMs = (value: number) => `${(value / 1000).toFixed(2)} s`
const fmtTbt = (value: number) => `${String(Math.round(value))} ms`
const fmtCls = (value: number) => value.toFixed(3)

export function renderMarkdown(summary: Summary): string {
  const { environment: env } = summary
  const lines: string[] = []
  lines.push('# Lighthouse audit', '')
  lines.push(
    `Generated ${env.generatedAt} from commit \`${env.commit}\`. Medians are taken per category and per metric over the runs of each page and profile; ✅ meets the brief's target (§10), ❌ misses it, ⚠️ is above the reference threshold for a Core Web Vital.`,
    '',
  )
  for (const profile of PROFILES) {
    const results = summary.results.filter((result) => result.profile === profile)
    if (results.length === 0) continue
    lines.push(
      `## ${profile === 'mobile' ? 'Mobile' : 'Desktop'} (median of ${String(results[0]?.runs.length ?? 0)} runs)`,
      '',
    )
    lines.push(
      `| Page | Performance (≥ ${String(SCORE_TARGETS.performance)}) | Accessibility (≥ ${String(SCORE_TARGETS.accessibility)}) | Best Practices (≥ ${String(SCORE_TARGETS['best-practices'])}) | SEO (≥ ${String(SCORE_TARGETS.seo)}) | LCP | CLS | TBT | FCP | SI |`,
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    )
    for (const result of results) {
      const cells = CATEGORIES.map(
        (id) =>
          `${meetsTarget(id, result.median.scores[id]) ? '✅' : '❌'} ${String(result.median.scores[id])}`,
      )
      const m = result.median.metrics
      const flag = (id: MetricId, text: string) =>
        (METRIC_THRESHOLDS[id] ?? Infinity) < m[id] ? `⚠️ ${text}` : text
      lines.push(
        `| \`${result.url}\` | ${cells.join(' | ')} | ${flag('largest-contentful-paint', fmtMs(m['largest-contentful-paint']))} | ${flag('cumulative-layout-shift', fmtCls(m['cumulative-layout-shift']))} | ${flag('total-blocking-time', fmtTbt(m['total-blocking-time']))} | ${fmtMs(m['first-contentful-paint'])} | ${fmtMs(m['speed-index'])} |`,
      )
    }
    lines.push('')
  }

  lines.push(
    '## Every run',
    '',
    '| Profile | Page | Run | Perf | A11y | BP | SEO | LCP | CLS | TBT |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  )
  for (const result of summary.results) {
    result.runs.forEach((run, index) => {
      const mark = run.file === result.representative ? ' (published)' : ''
      lines.push(
        `| ${result.profile} | ${result.page} | ${String(index + 1)}${mark} | ${String(run.scores.performance)} | ${String(run.scores.accessibility)} | ${String(run.scores['best-practices'])} | ${String(run.scores.seo)} | ${fmtMs(run.metrics['largest-contentful-paint'])} | ${fmtCls(run.metrics['cumulative-layout-shift'])} | ${fmtTbt(run.metrics['total-blocking-time'])} |`,
      )
    })
  }
  lines.push('')

  lines.push(
    '## Mock layer boot cost',
    '',
    'User Timing measures from `main.tsx`, observed (not throttled) on the audit host, median over the runs. `chunk` is the download and evaluation of the lazy mock chunk, `worker` is `worker.start()` (registration and activation), `total` is both.',
    '',
    '| Profile | Page | chunk | worker | total |',
    '|---|---|---:|---:|---:|',
  )
  for (const result of summary.results) {
    const t = result.medianTimings
    const ms = (name: string) =>
      t[name] === undefined ? 'n/a' : `${String(Math.round(t[name]))} ms`
    lines.push(
      `| ${result.profile} | ${result.page} | ${ms('kurio:mocks-chunk')} | ${ms('kurio:mocks-worker')} | ${ms('kurio:mocks')} |`,
    )
  }
  lines.push('')

  lines.push('## Execution conditions', '')
  for (const condition of summary.conditions) lines.push(`- ${condition}`)
  lines.push('')
  lines.push('## Environment', '', '| | |', '|---|---|')
  const rows: [string, string][] = [
    ['Lighthouse', env.lighthouse],
    ['Lighthouse CI (`@lhci/cli`)', env.lhci],
    ['Browser', env.chrome],
    ['Host user agent', env.hostUserAgent],
    ['Benchmark index (CPU/memory)', String(Math.round(env.benchmarkIndex))],
    ['Node.js', env.node],
    ['OS', env.os],
    ['CPU', `${env.cpu} × ${String(env.cpuCount)}`],
    ['Memory', `${String(env.memoryGb)} GB`],
  ]
  for (const [key, value] of rows) lines.push(`| ${key} | ${value} |`)
  lines.push('')
  for (const profile of PROFILES) {
    const p = env.profiles[profile]
    lines.push(
      `- **${profile}**: form factor \`${p.formFactor}\`, ${p.screen}, throttling \`${p.throttlingMethod}\` (${Object.entries(
        p.throttling,
      )
        .map(([k, v]) => `${k} ${String(Math.round(v))}`)
        .join(', ')})`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

// ---- CLI ----------------------------------------------------------------------------------

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const RAW_DIR = path.join(root, 'reports/lighthouse')
export const PUBLISH_DIR = path.join(root, 'lighthouse/reports')

export const CONDITIONS = [
  'Build: `pnpm build` (Vite production build, minified, hashed assets), served by `vite preview` on `http://localhost:4173` (HTTP/1.1, gzip, no CDN).',
  'Mocks on (`VITE_ENABLE_MOCKS=true`, the default), scenario `default`, mock panel closed. Nothing is disabled for the audit.',
  'Each run starts in a fresh browser profile: empty storage, no cache, so every run registers the mock Service Worker (first visit).',
  'Mobile: Lighthouse default emulation (Moto G Power, 412×823 at 1.75 DPR, simulated slow 4G, 4× CPU slowdown). Desktop: the `desktop` preset (1350×940, simulated 40 ms RTT, 10 Mbps, no CPU slowdown). Both use simulated (Lantern) throttling.',
  'Three runs per page and profile, sequential, on an otherwise idle machine. Browser launched headless (`--headless=new`).',
]

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function lhciVersion(): string {
  try {
    const manifest = readJson(path.join(root, 'node_modules/@lhci/cli/package.json')) as {
      version: string
    }
    return manifest.version
  } catch {
    return 'unknown'
  }
}

function chromeVersion(userAgent: string): string {
  const executable = process.env.CHROME_PATH
  if (executable) {
    try {
      return execFileSync(executable, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      /* fall back to the user agent */
    }
  }
  return /(?:Headless)?Chrome\/[\d.]+/.exec(userAgent)?.[0] ?? userAgent
}

function gitCommit(): string {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    const dirty =
      execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== ''
    return dirty ? `${sha}+dirty` : sha
  } catch {
    return 'unknown'
  }
}

/** Collects every LHR of a profile's output folder and groups them by page. */
export function collect(
  profile: Profile,
  dir = path.join(RAW_DIR, profile),
): { page: PageId; file: string; lhr: LhrLike }[] {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.report.json'))
    .sort()
  return files.map((file) => {
    const lhr = readJson(path.join(dir, file)) as LhrLike
    const { pathname } = new URL(lhr.finalDisplayedUrl)
    const page = PAGES.find((candidate) => candidate.path === pathname)
    if (!page) throw new Error(`unexpected URL in ${file}: ${lhr.finalDisplayedUrl}`)
    return { page: page.id, file, lhr }
  })
}

export function buildSummary(rawDir = RAW_DIR): Summary {
  const results: PageResult[] = []
  const envs: Partial<Record<Profile, LhrLike>> = {}
  const benchmarks: number[] = []
  for (const profile of PROFILES) {
    const entries = collect(profile, path.join(rawDir, profile))
    benchmarks.push(...entries.map((entry) => entry.lhr.environment.benchmarkIndex))
    for (const page of PAGES) {
      const mine = entries.filter((entry) => entry.page === page.id)
      const firstLhr = mine[0]?.lhr
      if (!firstLhr) continue
      envs[profile] ??= firstLhr
      const origin = new URL(firstLhr.finalDisplayedUrl).origin
      results.push(
        summarizePage(
          page.id,
          origin + page.path,
          profile,
          mine.map((entry) => readRun(entry.file, entry.lhr)),
        ),
      )
    }
  }
  const first = envs.mobile ?? envs.desktop
  if (!first)
    throw new Error(`no Lighthouse reports found in ${rawDir}; run \`pnpm lighthouse\` first`)
  const profileInfo = (lhr: LhrLike | undefined) => {
    const settings = (lhr ?? first).configSettings
    const screen = settings.screenEmulation
    return {
      formFactor: settings.formFactor,
      throttlingMethod: settings.throttlingMethod,
      throttling: settings.throttling,
      screen: `${String(screen.width)}×${String(screen.height)} @ ${String(screen.deviceScaleFactor)}x`,
    }
  }
  const cpus = os.cpus()
  const environment: Environment = {
    generatedAt: new Date().toISOString(),
    lighthouse: first.lighthouseVersion,
    lhci: lhciVersion(),
    chrome: chromeVersion(first.environment.hostUserAgent),
    hostUserAgent: first.environment.hostUserAgent,
    benchmarkIndex: median(benchmarks),
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus[0]?.model ?? 'unknown',
    cpuCount: cpus.length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    commit: gitCommit(),
    profiles: { mobile: profileInfo(envs.mobile), desktop: profileInfo(envs.desktop) },
  }
  return { environment, conditions: CONDITIONS, results }
}

export function writeSummary(summary: Summary, outDir: string): void {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(path.join(outDir, 'summary.md'), renderMarkdown(summary))
}

/** Copies the summary and each group's representative report under stable names. */
export function publish(summary: Summary, rawDir = RAW_DIR, outDir = PUBLISH_DIR): string[] {
  mkdirSync(outDir, { recursive: true })
  writeSummary(summary, outDir)
  const written = ['summary.md', 'summary.json']
  for (const result of summary.results) {
    const stem = result.representative.replace(/\.report\.json$/, '')
    for (const ext of ['html', 'json'] as const) {
      const name = `${result.page}-${result.profile}.report.${ext}`
      copyFileSync(
        path.join(rawDir, result.profile, `${stem}.report.${ext}`),
        path.join(outDir, name),
      )
      written.push(name)
    }
  }
  return written
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = buildSummary()
  writeSummary(summary, RAW_DIR)
  console.log(renderMarkdown(summary))
  if (process.argv.includes('--publish')) {
    console.log(`Published to ${path.relative(root, PUBLISH_DIR)}: ${publish(summary).join(', ')}`)
  }
}
