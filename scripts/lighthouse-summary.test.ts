import { describe, expect, it } from 'vitest'

import {
  CATEGORIES,
  median,
  meetsTarget,
  readRun,
  renderMarkdown,
  summarizePage,
  type LhrLike,
  type Summary,
} from './lighthouse-summary.ts'

/** A minimal Lighthouse result with the given category scores (0–1) and metric values. */
function lhr(scores: number[], lcp: number, tbt: number, mocks?: number): LhrLike {
  const [performance = 0, accessibility = 0, bestPractices = 0, seo = 0] = scores
  return {
    lighthouseVersion: '12.6.1',
    finalDisplayedUrl: 'http://localhost:4173/',
    fetchTime: '2026-10-28T00:00:00.000Z',
    userAgent: 'HeadlessChrome/156.0.0.0',
    environment: {
      hostUserAgent: 'HeadlessChrome/156.0.0.0',
      networkUserAgent: '',
      benchmarkIndex: 2000,
    },
    configSettings: {
      formFactor: 'mobile',
      throttlingMethod: 'simulate',
      throttling: { rttMs: 150 },
      screenEmulation: { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true },
    },
    categories: {
      performance: { score: performance },
      accessibility: { score: accessibility },
      'best-practices': { score: bestPractices },
      seo: { score: seo },
    },
    audits: {
      'largest-contentful-paint': { numericValue: lcp },
      'cumulative-layout-shift': { numericValue: 0 },
      'total-blocking-time': { numericValue: tbt },
      'first-contentful-paint': { numericValue: lcp - 500 },
      'speed-index': { numericValue: lcp - 500 },
      'user-timings': {
        details: {
          items: [
            ...(mocks === undefined ? [] : [{ name: 'kurio:mocks', duration: mocks }]),
            { name: 'unrelated', duration: 1 },
          ],
        },
      },
    },
  }
}

describe('median', () => {
  it('picks the middle value of an odd list, whatever the order', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('averages the two middle values of an even list', () => {
    expect(median([1, 2, 3, 10])).toBe(2.5)
  })
})

describe('summarizePage', () => {
  const runs = [
    readRun('a.report.json', lhr([0.72, 1, 1, 0.92], 4800, 150, 90)),
    readRun('b.report.json', lhr([0.7, 0.96, 1, 1], 5200, 100, 110)),
    readRun('c.report.json', lhr([0.74, 1, 0.93, 1], 4600, 200, 100)),
  ]
  const result = summarizePage('home', 'http://localhost:4173/', 'mobile', runs)

  it('takes the median of each category and metric on its own', () => {
    expect(result.median.scores).toEqual({
      performance: 72,
      accessibility: 100,
      'best-practices': 100,
      seo: 100,
    })
    expect(result.median.metrics['largest-contentful-paint']).toBe(4800)
    expect(result.median.metrics['total-blocking-time']).toBe(150)
  })

  it('keeps only the app User Timing measures, with their median', () => {
    expect(runs[0]?.timings).toEqual({ 'kurio:mocks': 90 })
    expect(result.medianTimings).toEqual({ 'kurio:mocks': 100 })
  })

  it('publishes the run closest to the median performance', () => {
    expect(result.representative).toBe('a.report.json')
  })
})

describe('targets and rendering', () => {
  it('checks the brief targets (90 / 95 / 95 / 90)', () => {
    expect(meetsTarget('performance', 90)).toBe(true)
    expect(meetsTarget('performance', 89)).toBe(false)
    expect(meetsTarget('accessibility', 94)).toBe(false)
    expect(meetsTarget('best-practices', 95)).toBe(true)
    expect(meetsTarget('seo', 90)).toBe(true)
    expect(CATEGORIES).toHaveLength(4)
  })

  it('renders the medians, the runs, the environment and the thresholds', () => {
    const runs = [
      readRun('a.report.json', lhr([0.72, 1, 1, 0.92], 4800, 150, 90)),
      readRun('b.report.json', lhr([0.7, 0.96, 1, 1], 5200, 100, 110)),
      readRun('c.report.json', lhr([0.74, 1, 0.93, 1], 4600, 200, 100)),
    ]
    const summary: Summary = {
      environment: {
        generatedAt: '2026-10-28T00:00:00.000Z',
        lighthouse: '12.6.1',
        lhci: '0.15.1',
        chrome: 'Chromium 156',
        hostUserAgent: 'HeadlessChrome/156.0.0.0',
        benchmarkIndex: 2000,
        node: 'v24.11.0',
        os: 'Linux 7.2 (x64)',
        cpu: 'Test CPU',
        cpuCount: 8,
        memoryGb: 16,
        commit: 'abc1234',
        profiles: {
          mobile: {
            formFactor: 'mobile',
            throttlingMethod: 'simulate',
            throttling: { rttMs: 150 },
            screen: '412×823 @ 1.75x',
          },
          desktop: {
            formFactor: 'desktop',
            throttlingMethod: 'simulate',
            throttling: { rttMs: 40 },
            screen: '1350×940 @ 1x',
          },
        },
      },
      conditions: ['Mocks on.'],
      results: [summarizePage('home', 'http://localhost:4173/', 'mobile', runs)],
    }
    const markdown = renderMarkdown(summary)
    expect(markdown).toContain(
      '| `http://localhost:4173/` | ❌ 72 | ✅ 100 | ✅ 100 | ✅ 100 | ⚠️ 4.80 s | 0.000 | 150 ms |',
    )
    expect(markdown).toContain('| Lighthouse | 12.6.1 |')
    expect(markdown).toContain('| Lighthouse CI (`@lhci/cli`) | 0.15.1 |')
    expect(markdown).toContain('| Node.js | v24.11.0 |')
    expect(markdown).toContain('| mobile | home | n/a | n/a | 100 ms |')
  })
})
