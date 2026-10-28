import { expect, type Page } from '@playwright/test'

/** The document never scrolls sideways (DS-31); explicit scrollers inside the page are allowed. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `scrollWidth ${String(scrollWidth)} > clientWidth ${String(clientWidth)}`,
  ).toBeLessThanOrEqual(clientWidth)
}
