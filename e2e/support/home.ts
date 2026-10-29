import { expect, type Page } from '@playwright/test'

/**
 * The home page's `h1` is the first hero slide's title (long copy on desktop, short on mobile), or
 * a hidden "KURIO" when the highlights failed (spec 05). It shows once the page has rendered.
 */
export function homeHeading(page: Page) {
  return page.getByRole('heading', { level: 1 })
}

export async function openHome(page: Page, url = '/') {
  await page.goto(url)
  await expect(homeHeading(page)).toBeVisible()
}
