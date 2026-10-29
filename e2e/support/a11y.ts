import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

/**
 * Elements that fade between a dimmed (refetching) and a settled state carry `transition-opacity`.
 * axe reads the computed opacity, so a scan taken mid-fade measures a washed-out text color and
 * fails color-contrast on a screen that is fine once it settles (the flake of spec 10, `quote-total`
 * under load). Waiting for the attribute that marks "outdated" is not enough: it goes away when the
 * fade starts. This waits for the fade to end.
 */
export async function expectSettledOpacity(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll('[class*="transition-opacity"]')].filter((element) => {
              // 0 is a control revealed on hover or focus (the card actions); 1 is settled.
              const opacity = Number(getComputedStyle(element).opacity)
              return opacity > 0 && opacity < 1
            }).length,
        ),
      { message: 'elements still dimmed or fading', timeout: 5000 },
    )
    .toBe(0)
}

/** axe with WCAG 2.2 A/AA tags; only `serious` and `critical` violations fail (spec 01 §9). */
export async function expectNoAxeViolations(page: Page) {
  await expectSettledOpacity(page)
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const blocking = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }))
  expect(blocking, 'serious/critical axe violations').toEqual([])
}

// Helpers of spec 11 (design §1): keyboard paths, focus checks, live-region capture and the zoom
// and text-spacing conditions of WCAG 1.4.4 / 1.4.10 / 1.4.12.

/** `role "name"` of the focused element, from its ARIA snapshot (the accessible name as a user hears it). */
async function focusedLabel(page: Page): Promise<string> {
  const focused = page.locator(':focus')
  if ((await focused.count()) === 0) return ''
  return (
    (await focused.first().ariaSnapshot({ timeout: 2000 })).replace(/^- /, '').split('\n')[0] ?? ''
  )
}

/**
 * Presses `Tab` until the focused element's `role "name"` matches, failing after `max` presses.
 * Returns the number of presses, so a focus-order test reads as a budget ("at most 12 stops").
 * With `visible`, every stop must pass `expectFocusVisible` on the way (A11Y-05).
 */
export async function tabTo(
  page: Page,
  name: RegExp | string,
  {
    max = 40,
    visible = false,
    backwards = false,
  }: { max?: number; visible?: boolean; backwards?: boolean } = {},
): Promise<number> {
  const matches = (label: string) =>
    typeof name === 'string' ? label.includes(name) : name.test(label)
  const seen: string[] = []
  for (let presses = 1; presses <= max; presses++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab')
    const label = await focusedLabel(page)
    seen.push(label)
    if (matches(label)) {
      if (visible) await expectFocusVisible(page)
      return presses
    }
    if (visible && label) await expectFocusVisible(page)
  }
  throw new Error(
    `Tab never reached ${String(name)} in ${String(max)} presses. Stops: ${seen.join(' | ')}`,
  )
}

/**
 * The focused element shows the spec 01 indicator (an outline of 2 px or more; input groups draw
 * it on the group) and nothing fixed covers it (WCAG 2.4.7, 2.4.11): the hit test at its centre
 * returns the element itself or a descendant.
 */
export async function expectFocusVisible(page: Page) {
  const result = await page.evaluate(() => {
    const element = document.activeElement
    if (!element || element === document.body) return { problem: 'nothing is focused' }
    const label = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} "${(element.getAttribute('aria-label') ?? element.textContent).trim().slice(0, 40)}" [${(element.getAttribute('class') ?? '').slice(0, 60)}]`
    // A visually hidden native control (the catalog's checkboxes) draws its indicator on the label
    // around it; input groups draw it on the group around the input and its addons.
    const hidden = element.getBoundingClientRect().width <= 1
    const ringed = (candidate: Element | null) => {
      if (!candidate) return false
      const style = getComputedStyle(candidate)
      return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2
    }
    const host =
      [
        hidden ? element.closest('label') : element,
        element.closest('[data-slot=input-group]'),
        element.closest('label'),
        element,
      ].find(ringed) ?? element
    if (!ringed(host)) return { problem: `${label} has no 2 px outline` }
    host.scrollIntoView({ block: 'nearest' })
    const box = host.getBoundingClientRect()
    const x = Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1)
    const y = Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1)
    const hit = document.elementFromPoint(x, y)
    if (!hit || !(host.contains(hit) || hit.contains(host))) {
      return {
        problem: `${label} is covered by ${hit?.tagName.toLowerCase() ?? 'nothing'} "${hit?.getAttribute('aria-label') ?? hit?.textContent.trim().slice(0, 30) ?? ''}"`,
      }
    }
    return { problem: null }
  })
  expect(result.problem, 'focus indicator').toBeNull()
}

/** Tab and Shift+Tab never leave `container` (a dialog or sheet): focus is trapped inside. */
export async function expectFocusTrapped(page: Page, container: Locator, presses = 14) {
  for (let step = 0; step < presses; step++) {
    await page.keyboard.press(step % 5 === 4 ? 'Shift+Tab' : 'Tab')
    await expect(container.locator(':focus'), `focus after press ${String(step + 1)}`).toHaveCount(
      1,
    )
  }
}

// Text written to a live region or shown as a toast, collected for the whole page life.
declare global {
  interface Window {
    __live?: string[]
  }
}

/**
 * Installs the observer; call before the first `goto`. It records each text that appears in a live
 * region (`aria-live`, `status`, `alert`) and each toast as it is added, so a test can assert "once".
 */
export async function recordLiveMessages(page: Page) {
  await page.addInitScript(() => {
    const live: string[] = []
    window.__live = live
    const last = new WeakMap<Element, string>()
    const regionOf = (node: Node) =>
      (node instanceof Element ? node : node.parentElement)?.closest(
        '[aria-live]:not([aria-live=off]), [role=status], [role=alert]',
      )
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added instanceof Element) {
            for (const toast of [
              ...(added.matches('[data-sonner-toast]') ? [added] : []),
              ...added.querySelectorAll('[data-sonner-toast]'),
            ]) {
              live.push(`toast: ${toast.textContent.trim()}`)
            }
          }
        }
        const region = regionOf(mutation.target)
        // A toast is recorded when it is added (above); its list is not a second announcement.
        if (!region || region.closest('[aria-label^=Notifica]')) continue
        const text = region.textContent.trim()
        if (text && last.get(region) !== text)
          live.push(`${region.getAttribute('role') ?? 'live'}: ${text}`)
        last.set(region, text)
      }
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
}

export const liveMessages = (page: Page) => page.evaluate(() => window.__live ?? [])

/** The WCAG 1.4.12 stylesheet: text spacing at the minimum the criterion asks users to be able to set. */
export async function withTextSpacing(page: Page) {
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
  })
}

/**
 * Browser zoom as Chromium implements it: the layout viewport shrinks to `1280 / factor` CSS px
 * and everything grows by `factor`. 200 % of 1280 is a 640 px layout, 400 % is the 320 px reflow.
 */
export async function zoomTo(page: Page, factor: number, height = 800) {
  await page.setViewportSize({
    width: Math.round(1280 / factor),
    height: Math.round(height / factor),
  })
}

/** Presses `Tab` `count` times; every stop shows its indicator and is not covered by a fixed bar. */
export async function tabThrough(page: Page, count: number) {
  for (let press = 0; press < count; press++) {
    await page.keyboard.press('Tab')
    if ((await page.locator(':focus').count()) > 0) await expectFocusVisible(page)
  }
}

/**
 * Every control marked invalid has a message tied to it: `aria-describedby` resolves to an element
 * with text (A11Y-08). Returns the controls checked, so a test can also assert how many there are.
 */
export async function expectInvalidFieldsDescribed(scope: Locator): Promise<number> {
  const result = await scope.evaluate((root) => {
    const problems: string[] = []
    const invalid = [...root.querySelectorAll('[aria-invalid=true]')]
    for (const control of invalid) {
      const label = control.getAttribute('name') ?? (control.id || control.tagName)
      const ids = (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
      const texts = ids.map((id) => document.getElementById(id)?.textContent.trim() ?? '')
      if (!texts.some((text) => text.length > 0))
        problems.push(`${label}: no message in aria-describedby`)
    }
    return { count: invalid.length, problems }
  })
  expect(result.problems, 'invalid controls without a message').toEqual([])
  return result.count
}

/**
 * No text is cut off by its own box (WCAG 1.4.12): a visible element that holds text and clips its
 * overflow must show all of it. Intentional scrollers (carousel track, tab strips) and truncated
 * names (`text-overflow: ellipsis`, which carry a `title`) are not text containers in this sense.
 */
export async function expectNoClippedText(page: Page) {
  const clipped = await page.evaluate(() => {
    const out: string[] = []
    for (const element of document.querySelectorAll('body *')) {
      if (!(element instanceof HTMLElement) || !element.checkVisibility()) continue
      const style = getComputedStyle(element)
      const clips = [style.overflowX, style.overflowY].some(
        (value) => value === 'hidden' || value === 'clip',
      )
      // `sr-only` text is clipped to 1 px by design.
      if (
        !clips ||
        style.textOverflow === 'ellipsis' ||
        element.classList.contains('sr-only') ||
        element.clientWidth <= 1 ||
        element.clientHeight <= 1
      )
        continue
      const ownText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0,
      )
      if (!ownText) continue
      if (
        element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1
      ) {
        out.push(`${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 40)}"`)
      }
    }
    return out
  })
  expect(clipped, 'text clipped by its own box').toEqual([])
}

/**
 * Contrast of text that sits on artwork, gradients or shapes, which axe cannot judge (A11Y-14,
 * design §8). Each text-bearing element inside `scope` is measured: its text is hidden, the box is
 * screenshotted, and every pixel of what was behind the text is compared with the text color at the
 * WCAG 2.2 AA ratio for its size (4.5, or 3 for large text). Returns how many elements were sampled.
 */
export async function expectReadableOverArtwork(page: Page, scope: Locator): Promise<number> {
  const targets = await scope.evaluate((root) => {
    const found: {
      x: number
      y: number
      width: number
      height: number
      color: string
      large: boolean
      text: string
    }[] = []
    root.scrollIntoView({ block: 'start' })
    for (const element of root.querySelectorAll('*')) {
      if (
        !(element instanceof HTMLElement) ||
        !element.checkVisibility() ||
        element.closest('.sr-only')
      )
        continue
      const own = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => (node.textContent ?? '').trim())
        .join(' ')
        .trim()
      if (!own) continue
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const size = Number.parseFloat(style.fontSize)
      const bold = Number.parseInt(style.fontWeight, 10) >= 700
      // Off to the side (the other slides of the carousel) is not on screen.
      if (box.width < 1 || box.height < 1 || box.left < 0 || box.right > innerWidth) continue
      found.push({
        x: box.left + scrollX,
        y: box.top + scrollY,
        width: box.width,
        height: box.height,
        color: style.color,
        large: size >= 24 || (bold && size >= 18.66),
        text: own.slice(0, 30),
      })
    }
    return found
  })
  // Text hidden, so the pixels are only what is behind it.
  const hide = await page.addStyleTag({
    content:
      '* { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important }',
  })
  const inset = (size: number) => (size > 16 ? 4 : 0)
  const failures: string[] = []
  try {
    for (const target of targets) {
      const shot = await page.screenshot({
        // Inset a little: the rounded corners of a button show the page behind it, not its text.
        clip: {
          x: target.x + inset(target.width),
          y: target.y + inset(target.height),
          width: target.width - 2 * inset(target.width),
          height: target.height - 2 * inset(target.height),
        },
        fullPage: true,
      })
      const worst = await page.evaluate(
        async ([base64, color, large]) => {
          const bitmap = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${base64}`)).blob(),
          )
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = canvas.getContext('2d')
          if (!context) return 21
          context.drawImage(bitmap, 0, 0)
          const channel = (value: number) => {
            const unit = value / 255
            return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
          }
          const luminance = (r: number, g: number, b: number) =>
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
          const [tr = 0, tg = 0, tb = 0] = (color.match(/[\d.]+/g) ?? []).map(Number)
          const text = luminance(tr, tg, tb)
          const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
          let min = 21
          for (let index = 0; index < data.length; index += 4) {
            const back = luminance(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)
            const ratio = (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05)
            if (ratio < min) min = ratio
          }
          return large ? min / 1.5 : min
        },
        [shot.toString('base64'), target.color, target.large] as const,
      )
      // `large` text needs 3, other text 4.5: scaling the large ones by 1.5 lets one threshold do.
      if (worst < 4.5)
        failures.push(
          `"${target.text}" ${target.color}: worst ${(target.large ? worst * 1.5 : worst).toFixed(2)}:1`,
        )
    }
  } finally {
    await hide.evaluate((element) => {
      ;(element as unknown as ChildNode).remove()
    })
  }
  expect(failures, 'text below the AA contrast ratio over its background').toEqual([])
  return targets.length
}
