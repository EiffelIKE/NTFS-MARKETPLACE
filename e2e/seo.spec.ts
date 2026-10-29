import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../src/lib/seo'

import { expect, test } from './support/test'

test('link previews work without JavaScript, including on a deep link', async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error('Missing Playwright baseURL')
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  try {
    for (const path of ['/', '/nfts/emerald-ape-042']) {
      await page.goto(path)
      await expect(page).toHaveTitle(SITE_TITLE)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        SITE_DESCRIPTION,
      )
      for (const [property, content] of Object.entries({
        'og:type': 'website',
        'og:title': SITE_TITLE,
        'og:description': SITE_DESCRIPTION,
        'og:url': `${SITE_URL}/`,
        'og:image': SHARE_IMAGE,
        'og:locale': 'pt_BR',
      })) {
        await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute(
          'content',
          content,
        )
      }
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      )
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
        'content',
        SHARE_IMAGE,
      )
      // The SPA fallback must not tell Google that all NFT URLs are copies of the homepage.
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    }
  } finally {
    await context.close()
  }
})

test('the preview image and homepage sitemap are public static files', async ({ request }) => {
  const image = await request.get('/og-image.jpg')
  expect(image.ok()).toBe(true)
  expect(image.headers()['content-type']).toContain('image/jpeg')
  expect((await image.body()).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  expect(sitemap.headers()['content-type']).toContain('xml')
  expect(await sitemap.text()).toContain(`<loc>${SITE_URL}/</loc>`)
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
})

test('Google metadata follows navigation without duplicates or stale canonicals', async ({
  page,
}) => {
  await page.goto('/?sort=popular#mercado')
  await expect(page).toHaveTitle(SITE_TITLE)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/`)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')

  // Follow a real internal link so this also checks the static-to-router handoff and SPA updates.
  await page.locator('a[href="/nfts/emerald-ape-042"]').first().click()
  await expect(page).toHaveTitle('Emerald Ape #042 · KURIO')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${SITE_URL}/nfts/emerald-ape-042`,
  )
  const description = page.locator('meta[name="description"]')
  await expect(description).toHaveCount(1)
  await expect(description).not.toHaveAttribute('content', SITE_DESCRIPTION)
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    (await description.getAttribute('content')) ?? '',
  )
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${SITE_URL}/nfts/emerald-ape-042`,
  )
  await expect(page.locator('head title')).toHaveCount(1)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')

  await page.goBack()
  await expect(page).toHaveTitle(SITE_TITLE)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/`)
  await expect(description).toHaveAttribute('content', SITE_DESCRIPTION)
  await page.getByRole('link', { name: 'Carrinho', exact: true }).click()
  await expect(page).toHaveTitle('Carrinho · KURIO')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(description).toHaveAttribute('content', SITE_DESCRIPTION)

  await page.goBack()
  await expect(page).toHaveTitle(SITE_TITLE)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
})

test('a direct NFT link drops edition and tracking parameters from its canonical', async ({
  page,
}) => {
  await page.goto('/nfts/emerald-ape-042?edition=unique&utm_source=share')
  await expect(page).toHaveTitle('Emerald Ape #042 · KURIO')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${SITE_URL}/nfts/emerald-ape-042`,
  )
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
})

test.describe('a nonexistent NFT', () => {
  // The mock API deliberately returns 404; Chrome also logs that expected HTTP response.
  test.use({
    allowedConsoleErrors: [
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
    ],
  })

  test('is not indexable', async ({ page }) => {
    await page.goto('/nfts/does-not-exist')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  })
})
