import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { envSchema } from '../src/lib/env-schema.ts'
import { OPERATION_IDS } from '../src/contracts/operations.ts'
import { CREDENTIALS } from '../src/mocks/fixtures/credentials.ts'
import { SCENARIO_LIST } from '../src/mocks/scenarios.ts'

import {
  markers,
  readSection,
  renderSections,
  SECTION_NAMES,
  writeSection,
  type SectionName,
} from './docs.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const update = process.env.UPDATE_DOCS === '1'

/** Which delivery document holds each generated section. */
const OWNER: Record<SectionName, 'README.md' | 'ARCHITECTURE.md'> = {
  operations: 'ARCHITECTURE.md',
  errors: 'ARCHITECTURE.md',
  scenarios: 'README.md',
}

describe('generated sections', () => {
  const rendered = renderSections()

  for (const name of SECTION_NAMES) {
    it(`"${name}" in ${OWNER[name]} matches the code`, () => {
      const file = OWNER[name]
      const document = read(file)
      expect(
        readSection(document, name),
        `${file} needs ${markers(name).open} … ${markers(name).close}`,
      ).not.toBeNull()
      if (update) {
        writeFileSync(path.join(root, file), writeSection(document, name, rendered[name]))
        return
      }
      expect(
        readSection(document, name),
        `stale: run \`pnpm docs:update\` to refresh ${file}`,
      ).toBe(rendered[name])
    })
  }

  it('lists every operation and every scenario', () => {
    const operations = rendered.operations.split('\n').slice(2)
    expect(operations).toHaveLength(OPERATION_IDS.length)
    const scenarios = rendered.scenarios.split('\n').slice(2)
    expect(scenarios).toHaveLength(SCENARIO_LIST.length)
  })

  it('writeSection and readSection round-trip and leave the rest alone', () => {
    const document = `before\n${markers('errors').open}\n\nold\n\n${markers('errors').close}\nafter\n`
    const next = writeSection(document, 'errors', 'new')
    expect(readSection(next, 'errors')).toBe('new')
    expect(next.startsWith('before\n')).toBe(true)
    expect(next.endsWith('\nafter\n')).toBe(true)
    expect(writeSection('no markers', 'errors', 'new')).toBe('no markers')
  })
})

describe('README.md', () => {
  const readme = read('README.md')
  const scripts = Object.keys((JSON.parse(read('package.json')) as { scripts: object }).scripts)

  it('names the scripts of package.json, and only those', () => {
    const mentioned = new Set(
      [...readme.matchAll(/`pnpm (?:run )?([\w:-]+)[^`]*`/g)].map((match) => match[1] ?? ''),
    )
    // `install`, `exec`, `preview` and `dlx` style commands are pnpm's own, not scripts.
    const builtin = new Set(['install', 'exec', 'dlx', 'add', 'run'])
    for (const name of mentioned) {
      if (builtin.has(name)) continue
      expect(scripts, `README mentions \`pnpm ${name}\`, which is not in package.json`).toContain(
        name,
      )
    }
    for (const script of scripts) {
      expect(readme, `README does not document \`pnpm ${script}\``).toContain(`pnpm ${script}`)
    }
  })

  it('documents every environment variable of the schema and .env.example', () => {
    const example = read('.env.example')
    for (const name of [...Object.keys(envSchema.shape), 'VITE_ENABLE_DEV_ROUTES']) {
      expect(readme, `README lacks ${name}`).toContain(`\`${name}\``)
      expect(example, `.env.example lacks ${name}`).toContain(`${name}=`)
    }
  })

  it('lists the demo accounts exactly as the fixtures define them', () => {
    for (const { email, password } of Object.values(CREDENTIALS)) {
      expect(readme).toContain(email)
      expect(readme).toContain(password)
    }
  })

  it('shows the scenario selector of every scenario', () => {
    for (const { id } of SCENARIO_LIST) expect(readme).toContain(`?scenario=${id}`)
  })
})

describe('relative links', () => {
  for (const file of ['README.md', 'ARCHITECTURE.md']) {
    it(`${file} points only at files that exist`, () => {
      const links = [...read(file).matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)].map(
        (match) => match[1] ?? '',
      )
      expect(links.length).toBeGreaterThan(0)
      for (const link of links) {
        const target = link.split('#')[0] ?? ''
        expect(existsSync(path.join(root, target)), `${file} links to missing ${link}`).toBe(true)
      }
    })
  }
})

describe('ARCHITECTURE.md', () => {
  const architecture = read('ARCHITECTURE.md')

  it('maps every required E2E scenario to a file that exists', () => {
    const files = [...architecture.matchAll(/`(e2e\/[\w-]+\.spec\.ts)`/g)].map((m) => m[1] ?? '')
    expect(new Set(files).size).toBeGreaterThanOrEqual(13)
    for (const file of files) expect(existsSync(path.join(root, file)), file).toBe(true)
  })
})
