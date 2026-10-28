import type { Page } from '@playwright/test'

import { expectNoAxeViolations } from './support/a11y'
import { openHome } from './support/home'
import { expectNoHorizontalOverflow } from './support/layout'
import { expect, test } from './support/test'

// Spec 01 design §9 E2E table. Runs in both projects; rows that only exist in one shell skip the
// other one.

const GALLERY = '/dev/ui-kit'

async function openGallery(page: Page) {
  await page.goto(GALLERY)
  await expect(page.getByRole('heading', { level: 1, name: 'UI kit' })).toBeVisible()
}

function toasts(page: Page) {
  return page.getByRole('region', { name: /Notificações/ })
}

test.describe('shell per viewport (DS-24)', () => {
  const desktopLogo = (page: Page) => page.getByRole('link', { name: 'KURIO, início' })
  const tabBarProfile = (page: Page) =>
    page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Perfil' })

  test('1024 px shows the desktop header and footer, no tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await openHome(page)
    await expect(desktopLogo(page)).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(tabBarProfile(page)).toBeHidden()
  })

  test('1023 px shows the tab bar, no desktop header or footer', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 })
    await openHome(page)
    await expect(tabBarProfile(page)).toBeVisible()
    await expect(desktopLogo(page)).toBeHidden()
    await expect(page.getByRole('contentinfo')).toBeHidden()
  })
})

test('header: active item, empty cart and the login link (DS-25, DS-28)', async ({
  page,
  isMobile,
}) => {
  await openHome(page)
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await expect(nav.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')

  // Desktop: header actions; mobile: tab bar.
  const cart = (isMobile ? nav : page.getByRole('banner')).getByRole('link', {
    name: 'Carrinho',
    exact: true,
  })
  await expect(cart).toBeVisible()
  await expect(cart.locator('[data-slot=badge]')).toHaveCount(0)

  if (!isMobile) {
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toHaveAttribute(
      'href',
      '/login?redirect=%2F',
    )
  }
})

test.describe('unavailable controls (DS-29)', () => {
  // Mobile home has no unavailable control any more (the tab bar heart is the favorites list since
  // spec 05), so there the gallery's "Fora do escopo" section stands in.
  async function openHost(page: Page, isMobile: boolean) {
    if (isMobile) await openGallery(page)
    else await openHome(page)
    return page.url()
  }

  test('click shows the notice and stays on the page', async ({ page, isMobile }) => {
    const url = await openHost(page, isMobile)
    // `force`: the control is `aria-disabled`, which Playwright treats as not clickable.
    await page.getByRole('link', { name: 'Criadores' }).click({ force: true })
    await expect(toasts(page).getByText('Disponível em breve')).toBeVisible()
    await expect(page).toHaveURL(url)
  })

  test('Enter shows the notice and stays on the page', async ({ page, isMobile }) => {
    const url = await openHost(page, isMobile)
    await page.getByRole('link', { name: 'Criadores' }).focus()
    await page.keyboard.press('Enter')
    await expect(toasts(page).getByText('Disponível em breve')).toBeVisible()
    await expect(page).toHaveURL(url)
  })
})

test('newsletter: invalid email shows an error, valid email the demo notice (DS-17, DS-29)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the footer is desktop-only')
  await openHome(page)
  const email = page.getByRole('textbox', { name: 'E-mail para a newsletter' })
  const submit = page.getByRole('button', { name: 'Enviar' })

  await email.fill('nova@')
  await submit.click()
  await expect(page.getByText('Digite um e-mail válido.')).toBeVisible()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toBeFocused()

  await email.fill('nova@kurio.example')
  await submit.click()
  await expect(page.getByText('Newsletter indisponível nesta demonstração.')).toBeVisible()
  await expect(page.getByText('Digite um e-mail válido.')).toBeHidden()
  await expect(page.getByText(/inscri(ção|to) (confirmad|realizad)/i)).toHaveCount(0)
})

test('skip link is the first tab stop and moves focus to main (DS-30)', async ({ page }) => {
  await openHome(page)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#conteudo')).toBeFocused()
})

test('every focus stop in the gallery shows a 2 px outline (DS-15)', async ({ page }) => {
  await openGallery(page)
  const stops: string[] = []
  for (let step = 0; step < 300; step++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      // Input groups draw the outline on the group, around the input and its addons.
      const target = element.matches('[data-slot=input-group-control]')
        ? (element.closest('[data-slot=input-group]') ?? element)
        : element
      const style = getComputedStyle(target)
      const label = element.getAttribute('aria-label') ?? element.textContent.trim().slice(0, 40)
      return {
        key: `${element.tagName.toLowerCase()} "${label}"`,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        isSkip: element.getAttribute('href') === '#conteudo',
      }
    })
    if (!stop || (stop.isSkip && stops.length > 0)) break
    stops.push(stop.key)
    expect.soft(stop.outlineStyle, stop.key).not.toBe('none')
    expect.soft(stop.outlineWidth, stop.key).toBeGreaterThanOrEqual(2)
  }
  expect(stops.length).toBeGreaterThan(20)
})

test.describe('dialog and sheet keep focus inside and restore it (DS-18)', () => {
  for (const { trigger, title } of [
    { trigger: 'Abrir diálogo', title: 'Remover do carrinho?' },
    { trigger: 'Abrir painel', title: 'Filtros' },
  ]) {
    test(title, async ({ page }) => {
      await openGallery(page)
      const button = page.getByRole('button', { name: trigger })
      await button.focus()
      await page.keyboard.press('Enter')

      const dialog = page.getByRole('dialog', { name: title })
      await expect(dialog).toBeVisible()
      const focusInside = () => dialog.evaluate((node) => node.contains(document.activeElement))
      await expect.poll(focusInside).toBe(true)
      for (let step = 0; step < 5; step++) {
        await page.keyboard.press('Tab')
        expect(await focusInside()).toBe(true)
      }

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(button).toBeFocused()
    })
  }
})

test('the self-hosted font loads and nothing leaves the app origin (DS-09)', async ({
  page,
  baseURL,
}) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await openGallery(page)
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('16px "Roboto Mono Variable"'))).toBe(true)

  const origin = new URL(baseURL ?? '').origin
  const external = requests.filter((url) => /^https?:/.test(url) && new URL(url).origin !== origin)
  expect(external).toEqual([])
})

test.describe('fallback font metrics (DS-10)', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('the sample keeps its height when the web font fails', async ({ page }) => {
    const sampleHeight = async () => {
      await openGallery(page)
      await page.evaluate(() => document.fonts.ready)
      const box = await page.getByTestId('font-metrics-sample').boundingBox()
      return box?.height ?? 0
    }

    const loaded = await sampleHeight()
    await page.context().route('**/*.woff2', (route) => route.abort())
    await page.reload()
    const fallback = await sampleHeight()
    expect(
      await page.evaluate(() => document.fonts.check('16px "Roboto Mono Variable"')),
      'web font should be unavailable',
    ).toBe(false)

    const lines = 3
    expect(Math.abs(fallback - loaded)).toBeLessThanOrEqual(lines)
  })
})

test('reduced motion stops the skeleton shimmer (DS-23)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openGallery(page)
  const skeleton = page.locator('[data-slot=skeleton]').first()
  await expect(skeleton).toHaveCSS('animation-name', 'none')
})

test('no horizontal overflow at 320 / 390 / 768 / 1440 (DS-31)', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await openHome(page)
    await expectNoHorizontalOverflow(page)
    await openGallery(page)
    await expectNoHorizontalOverflow(page)
  }
})

test('content ends above the mobile tab bar (DS-27)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the tab bar is mobile-only')
  await openHome(page)
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
  const last = await page.locator('main#conteudo > :last-child').boundingBox()
  const tabBar = await page.getByRole('navigation', { name: 'Principal' }).boundingBox()
  expect(last && tabBar).toBeTruthy()
  expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual((tabBar?.y ?? 0) + 0.5)
})

test('catalog cards carry srcset, sizes and intrinsic size (CAT-21, CAT-23)', async ({ page }) => {
  await openGallery(page)
  const cards = page.getByTestId('gallery-cards')
  const images = cards.locator('img')
  await expect(images).toHaveCount(4)
  for (const image of await images.all()) {
    const attributes = await image.evaluate((img: HTMLImageElement) => ({
      candidates: img.srcset.split(',').filter((candidate) => / \d+w$/.test(candidate.trim()))
        .length,
      sizes: img.sizes,
      width: img.getAttribute('width'),
      height: img.getAttribute('height'),
      alt: img.getAttribute('alt'),
    }))
    expect(attributes.candidates).toBe(3)
    expect(attributes.sizes).not.toBe('')
    expect(attributes.width).toBe('1000')
    expect(attributes.height).toBe('1000')
    // The card's link names the artwork, so the image itself is decorative.
    expect(attributes.alt).toBe('')
  }
  await expect(cards.getByText('Esgotado')).toBeVisible()
  await expect(cards.getByText('Preço anterior:')).toBeAttached()
})

test('toasts and announcements reach their live regions (DS-19)', async ({ page }) => {
  await openGallery(page)
  await page.getByRole('button', { name: 'Toast de sucesso' }).click()
  await expect(toasts(page).getByText('NFT adicionado ao carrinho')).toBeVisible()

  await page.getByRole('button', { name: 'Anunciar' }).click()
  await expect(page.getByTestId('announcer-polite')).toHaveText('3 resultados encontrados')
})

test.describe('axe: no serious or critical violations (DS-33)', () => {
  test('home', async ({ page }) => {
    await openHome(page)
    await expectNoAxeViolations(page)
  })

  test('gallery', async ({ page }) => {
    await openGallery(page)
    await expectNoAxeViolations(page)
  })
})
