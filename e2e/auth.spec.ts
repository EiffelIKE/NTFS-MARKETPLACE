import type { Locator, Page } from '@playwright/test'

import { CREDENTIALS, type CredentialName } from '../src/mocks/fixtures/credentials'
import { expectNoAxeViolations } from './support/a11y'
import { loginAs, mock, SESSION_STORAGE_KEY } from './support/mock'
import { realtime, waitForConnection } from './support/realtime'
import { expect, test } from './support/test'

// Spec 04 design §10 and brief scenario 3: sign-up, login, expiry, logout and user switch, through
// the real forms, router guards and the mock API. Both projects run it: the mobile one has no
// header menu (Figma draws none), so the steps that need "Sair" skip there and are covered by the
// cross-tab and unit tests.

// Rejections are the point of several tests, and the browser logs each 4xx and network failure.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const EXPIRED = 'Sua sessão expirou. Entre novamente para continuar.'

// The footer's newsletter field also has "E-mail" in its label, so the form fields are read from `main`.
const main = (page: Page) => page.getByRole('main')
const emailField = (page: Page) => main(page).getByLabel('E-mail', { exact: true })
const passwordField = (page: Page) => main(page).getByLabel('Senha', { exact: true })
const confirmField = (page: Page) => main(page).getByLabel('Confirmar senha', { exact: true })
const usernameField = (page: Page) => main(page).getByLabel('Nome de usuário', { exact: true })
const loginButton = (page: Page) => page.getByRole('button', { name: 'Entrar', exact: true })
const signupButton = (page: Page) => page.getByRole('button', { name: /^Criar (conta|perfil)$/ })
const toasts = (page: Page) => page.getByRole('region', { name: /Notificações/ })
const fieldErrors = (page: Page) => page.locator('[data-slot="field-error"]')
const menuTrigger = (page: Page, name: string) =>
  page.getByRole('button', { name: `Conta de ${name}` })

async function waitForMock(page: Page) {
  await page.waitForFunction(() => '__mock' in window)
}

async function authRequests(page: Page, op: 'auth.login' | 'auth.signup' | 'auth.session') {
  await waitForMock(page)
  return mock(page).requests({ op })
}

async function openLogin(page: Page, search = '') {
  await page.goto(`/login${search}`)
  await expect(emailField(page)).toBeVisible()
}

async function openSignup(page: Page) {
  await page.goto('/signup')
  await expect(usernameField(page)).toBeVisible()
}

async function fillLogin(page: Page, name: CredentialName) {
  await emailField(page).fill(CREDENTIALS[name].email)
  await passwordField(page).fill(CREDENTIALS[name].password)
  await loginButton(page).click()
}

async function fillSignup(
  page: Page,
  values: { username: string; email: string; password: string; confirm?: string },
) {
  await usernameField(page).fill(values.username)
  await emailField(page).fill(values.email)
  await passwordField(page).fill(values.password)
  await confirmField(page).fill(values.confirm ?? values.password)
}

/** Opens the menu with the keyboard, so the test also proves it is reachable that way. */
async function chooseFromMenu(page: Page, user: string, item: string) {
  await menuTrigger(page, user).click()
  await page.getByRole('menuitem', { name: item }).click()
}

async function storedSession(page: Page) {
  return page.evaluate<string | null, string>(
    (key) => localStorage.getItem(key),
    SESSION_STORAGE_KEY,
  )
}

async function focusedName(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement
    if (!element) return ''
    return (
      element.getAttribute('aria-label') ??
      element.getAttribute('placeholder') ??
      element.textContent.trim()
    )
  })
}

test.describe('sign-up', () => {
  test('creates the account, signs in and survives a reload (AUTH-01, AUTH-07, AUTH-08, AUTH-21)', async ({
    page,
    isMobile,
  }) => {
    await openSignup(page)
    await fillSignup(page, {
      username: 'nova_colecionadora',
      email: 'nova@kurio.example',
      password: 'Senha1234',
    })
    await signupButton(page).click()

    await expect(page).toHaveURL('/')
    await expect(toasts(page)).toContainText('Conta criada. Boas-vindas, nova_colecionadora!')
    if (!isMobile) await expect(menuTrigger(page, 'nova_colecionadora')).toBeVisible()
    expect(JSON.parse((await storedSession(page)) ?? '{}')).toMatchObject({
      user: { username: 'nova_colecionadora' },
    })

    // The same session after a reload, checked once with the server (the private route renders).
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible()
    expect(await authRequests(page, 'auth.session')).toHaveLength(1)
    if (!isMobile) await expect(menuTrigger(page, 'nova_colecionadora')).toBeVisible()
  })

  test('validates before sending anything (AUTH-01)', async ({ page }) => {
    await openSignup(page)
    await signupButton(page).click()

    await expect(fieldErrors(page)).toHaveCount(4)
    await expect(usernameField(page)).toBeFocused()
    await expect(usernameField(page)).toHaveAttribute('aria-invalid', 'true')
    expect(await authRequests(page, 'auth.signup')).toEqual([])

    // Errors update as the user types once a submit failed.
    await usernameField(page).fill('nova_colecionadora')
    await expect(usernameField(page)).not.toHaveAttribute('aria-invalid', 'true')
    await expect(fieldErrors(page)).toHaveCount(3)

    await emailField(page).fill('nova@kurio.example')
    await passwordField(page).fill('Senha1234')
    await confirmField(page).fill('Senha12345')
    await signupButton(page).click()
    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
    await expect(confirmField(page)).toBeFocused()
    expect(await authRequests(page, 'auth.signup')).toEqual([])
  })

  test('shows the API conflicts on their fields and keeps the values (AUTH-02)', async ({
    page,
  }) => {
    await openSignup(page)
    await fillSignup(page, {
      username: 'nova_colecionadora',
      email: CREDENTIALS.ana.email,
      password: 'Senha1234',
    })
    await signupButton(page).click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()
    await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(emailField(page)).toBeFocused()
    await expect(usernameField(page)).toHaveValue('nova_colecionadora')

    // Editing the field clears the server message.
    await emailField(page).fill('outra@kurio.example')
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeHidden()

    await usernameField(page).fill('anasouza')
    await signupButton(page).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()
    await expect(usernameField(page)).toBeFocused()
    await expect(emailField(page)).toHaveValue('outra@kurio.example')
    await expect(page).toHaveURL('/signup')
  })

  test('fields use the right autocomplete values (AUTH-06)', async ({ page }) => {
    await openSignup(page)
    await expect(usernameField(page)).toHaveAttribute('autocomplete', 'username')
    await expect(emailField(page)).toHaveAttribute('autocomplete', 'email')
    await expect(passwordField(page)).toHaveAttribute('autocomplete', 'new-password')
    await expect(confirmField(page)).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByText('Use de 8 a 72 caracteres, com letras e números.')).toBeVisible()
  })
})

test.describe('login', () => {
  test('a wrong password shows one alert, clears and focuses the password (AUTH-03)', async ({
    page,
  }) => {
    await openLogin(page)
    await emailField(page).fill(CREDENTIALS.ana.email)
    await passwordField(page).fill('senha-errada-1')
    await loginButton(page).click()

    await expect(main(page).getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
    await expect(passwordField(page)).toHaveValue('')
    await expect(passwordField(page)).toBeFocused()
    await expect(emailField(page)).not.toHaveAttribute('aria-invalid', 'true')
    await expect(passwordField(page)).not.toHaveAttribute('aria-invalid', 'true')
    await expect(emailField(page)).toHaveValue(CREDENTIALS.ana.email)
    expect(await storedSession(page)).toBeNull()

    // Trying again with the right one works, without a stale alert.
    await passwordField(page).fill(CREDENTIALS.ana.password)
    await loginButton(page).click()
    await expect(page).toHaveURL('/')
  })

  test('empty fields show per-field errors and focus the first (AUTH-01)', async ({ page }) => {
    await openLogin(page)
    await loginButton(page).click()
    await expect(fieldErrors(page)).toHaveCount(2)
    await expect(emailField(page)).toBeFocused()
    expect(await authRequests(page, 'auth.login')).toEqual([])
  })

  test('repeated clicks and Enter send one request (AUTH-05)', async ({ page }) => {
    await openLogin(page, '?scenario=slow')
    await emailField(page).fill(CREDENTIALS.ana.email)
    await passwordField(page).fill(CREDENTIALS.ana.password)
    await loginButton(page).click()
    await expect(loginButton(page)).toHaveAttribute('aria-busy', 'true')
    // `force`: the pending button is `aria-disabled`, which Playwright treats as not clickable.
    await loginButton(page).click({ force: true })
    await loginButton(page).click({ force: true })
    await passwordField(page).press('Enter')

    await expect(page).toHaveURL('/', { timeout: 15_000 })
    expect(await authRequests(page, 'auth.login')).toHaveLength(1)
  })

  test('without a connection: an alert, the values and an enabled button (AUTH-04)', async ({
    page,
  }) => {
    await openLogin(page, '?scenario=offline')
    await emailField(page).fill(CREDENTIALS.ana.email)
    await passwordField(page).fill(CREDENTIALS.ana.password)
    await loginButton(page).click()

    await expect(main(page).getByRole('alert')).toContainText('Sem conexão com o servidor')
    await expect(emailField(page)).toHaveValue(CREDENTIALS.ana.email)
    await expect(passwordField(page)).toHaveValue(CREDENTIALS.ana.password)
    await expect(loginButton(page)).not.toHaveAttribute('aria-busy', 'true')
    await expect(page).toHaveURL(/\/login/)
  })

  test('the password is never stored or put in the URL (AUTH-06)', async ({ page }) => {
    await openLogin(page)
    await expect(emailField(page)).toHaveAttribute('autocomplete', 'email')
    await expect(passwordField(page)).toHaveAttribute('autocomplete', 'current-password')
    await fillLogin(page, 'ana')
    await expect(page).toHaveURL('/')
    const everything = await page.evaluate(() =>
      JSON.stringify({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.fromEntries(Object.entries(sessionStorage)),
        url: location.href,
      }),
    )
    expect(everything).not.toContain(CREDENTIALS.ana.password)
    expect(everything).toContain('pbkdf2')
  })

  test('the password toggle has a name and a pressed state (AUTH-22)', async ({ page }) => {
    await openLogin(page)
    await passwordField(page).fill('segredo123')
    const toggle = page.getByRole('button', { name: 'Mostrar senha' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(page.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(passwordField(page)).toHaveAttribute('type', 'text')
  })
})

test.describe('protected routes and redirects (AUTH-11, AUTH-12)', () => {
  test('a visitor is sent to login and returns to the same path, search and hash', async ({
    page,
  }) => {
    await page.goto('/wallets?tab=1#x')
    await expect(emailField(page)).toBeVisible()
    const login = new URL(page.url())
    expect(login.pathname).toBe('/login')
    expect(login.searchParams.get('redirect')).toBe('/wallets?tab=1#x')
    // The private screen never rendered.
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toHaveCount(0)

    await fillLogin(page, 'ana')
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeVisible()
    const back = new URL(page.url())
    expect([back.pathname, back.search, back.hash]).toEqual(['/wallets', '?tab=1', '#x'])

    // The login page is not left in the history.
    await page.goBack()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test.describe('every private route', () => {
    for (const path of ['/checkout', '/orders/ord_000001', '/profile', '/wallets']) {
      test(`${path} needs a session`, async ({ page }) => {
        await page.goto(path)
        await expect(emailField(page)).toBeVisible()
        expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
      })
    }
  })

  test('login and sign-up pages carry the redirect to each other', async ({ page }) => {
    await openLogin(page, '?redirect=%2Fcart')
    await page
      .getByRole('link', { name: /Criar conta|Crie uma conta/ })
      .first()
      .click()
    await expect(usernameField(page)).toBeVisible()
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/cart')
  })

  test('an unsafe redirect is ignored', async ({ page }) => {
    await openLogin(page, '?redirect=https%3A%2F%2Fevil.test')
    await fillLogin(page, 'ana')
    await expect(page).toHaveURL('/')
  })

  test('a signed-in user opening login or sign-up goes where the redirect says', async ({
    page,
  }) => {
    await loginAs(page, 'ana')
    await page.goto('/login')
    await expect(page).toHaveURL('/')
    await page.goto('/signup?redirect=%2Fprofile')
    await expect(page).toHaveURL('/profile')
  })

  test('the close button leaves for a public redirect, and for home otherwise (AUTH-19)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the close button belongs to the desktop panel')
    await openLogin(page, '?redirect=%2Fcart')
    await page.getByRole('link', { name: 'Fechar' }).click()
    await expect(page).toHaveURL('/cart')

    await page.goto('/profile')
    await expect(emailField(page)).toBeVisible()
    await page.getByRole('link', { name: 'Fechar' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('expiry (AUTH-08, AUTH-13, AUTH-14, AUTH-15)', () => {
  test('a session that runs out in the page expires at the next private navigation', async ({
    page,
    isMobile,
  }) => {
    await page.clock.install()
    await openLogin(page, '?scenario=session-short')
    await fillLogin(page, 'ana')
    await expect(page).toHaveURL('/')

    await page.clock.runFor(61_000)
    // Desktop reaches wallets through the menu, mobile reaches the profile through the tab bar.
    const target = isMobile ? '/profile' : '/wallets'
    if (isMobile) {
      await page
        .getByRole('navigation', { name: 'Principal' })
        .getByRole('link', { name: 'Perfil' })
        .click()
    } else {
      await chooseFromMenu(page, 'Ana Souza', 'Carteiras')
    }

    await expect(page.getByText(EXPIRED)).toBeVisible()
    const login = new URL(page.url())
    expect(login.pathname).toBe('/login')
    expect(login.searchParams.get('reason')).toBe('expired')
    expect(login.searchParams.get('redirect')).toBe(target)
    expect(await storedSession(page)).toBeNull()

    await fillLogin(page, 'ana')
    await expect(page).toHaveURL(target)
  })

  test('a session the server dropped is caught when the app loads', async ({ page }) => {
    await loginAs(page, 'ana')
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible()

    await mock(page).expireSessions()
    await page.reload()

    await expect(page.getByText(EXPIRED)).toBeVisible()
    const login = new URL(page.url())
    expect(login.pathname).toBe('/login')
    expect(login.searchParams.get('redirect')).toBe('/profile')
    expect(login.searchParams.get('reason')).toBe('expired')
    expect(await storedSession(page)).toBeNull()
  })

  test('a 401 on a public page signs out and offers a way back (AUTH-15)', async ({ page }) => {
    await loginAs(page, 'ana')
    await page.goto('/dev/realtime')
    await expect(page.getByRole('heading', { level: 1, name: 'Tempo real' })).toBeVisible()
    await expect(page.getByText('Sessão: Ana Souza')).toBeVisible()
    await waitForConnection(page, { userId: 'usr_ana' })

    // The next private request is refused: the page keeps its place and its socket goes guest.
    await mock(page).expireSessions()
    await page.getByLabel('ID do pedido').fill('ord_000001')

    await expect(toasts(page)).toContainText(EXPIRED)
    await expect(page).toHaveURL('/dev/realtime')
    await expect(page.getByText('Sessão: visitante')).toBeVisible()
    expect(await storedSession(page)).toBeNull()
    await waitForConnection(page, { userId: null })

    await toasts(page).getByRole('button', { name: 'Entrar' }).click()
    const login = new URL(page.url())
    expect(login.pathname).toBe('/login')
    expect(login.searchParams.get('redirect')).toBe('/dev/realtime')
  })
})

test.describe('logout and user switch (AUTH-16, AUTH-17)', () => {
  test('"Sair" signs out, clears the session and leaves a private route', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mobile has no header menu: "Sair" lives in the profile screen (spec 08)')
    await loginAs(page, 'ana')
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible()

    await chooseFromMenu(page, 'Ana Souza', 'Sair')
    await expect(page).toHaveURL('/')
    await expect(toasts(page)).toContainText('Você saiu da sua conta.')
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
    expect(await storedSession(page)).toBeNull()

    const snapshot = await mock(page).snapshot()
    expect(Object.values(snapshot.sessions)).toEqual([])

    await page.goto('/profile')
    await expect(emailField(page)).toBeVisible()
    expect(new URL(page.url()).searchParams.has('reason')).toBe(false)
  })

  test('another user signing in replaces the socket and the data (AUTH-17)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'signing out needs the header menu')
    await openLogin(page)
    await fillLogin(page, 'ana')
    await expect(menuTrigger(page, 'Ana Souza')).toBeVisible()
    await waitForConnection(page, { userId: 'usr_ana' })

    await chooseFromMenu(page, 'Ana Souza', 'Sair')
    await waitForConnection(page, { userId: null })

    await page.getByRole('link', { name: 'Entrar' }).first().click()
    await emailField(page).fill(CREDENTIALS.bruno.email)
    await passwordField(page).fill(CREDENTIALS.bruno.password)
    await loginButton(page).click()

    await expect(menuTrigger(page, 'Bruno Lima')).toBeVisible()
    await expect
      .poll(async () => (await realtime(page).connections()).map((c) => c.userId))
      .toEqual(['usr_bruno'])
  })

  test('the header menu works with the keyboard (AUTH-21)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the menu is desktop-only')
    await loginAs(page, 'ana')
    await page.goto('/')
    const trigger = menuTrigger(page, 'Ana Souza')
    await trigger.focus()
    await page.keyboard.press('Enter')

    const items = page.getByRole('menuitem')
    await expect(items).toHaveText(['Meu perfil', 'Carteiras', 'Lista de interesse', 'Sair'])
    await expect(items.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Meu perfil' }).click()
    await expect(page).toHaveURL('/profile')
  })

  test('the menu follows a profile update without a reload (AUTH-21)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the menu is desktop-only')
    await loginAs(page, 'ana')
    await page.goto('/')
    await expect(menuTrigger(page, 'Ana Souza')).toBeVisible()
    // Spec 08 calls `session.updateUser`; another tab's identical write is the same path.
    const stored = JSON.parse((await storedSession(page)) ?? '{}') as {
      user: Record<string, unknown>
    }
    const other = await page.context().newPage()
    await other.goto('/')
    await other.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, value)
      },
      [
        SESSION_STORAGE_KEY,
        JSON.stringify({ ...stored, user: { ...stored.user, displayName: 'Ana S.' } }),
      ] as const,
    )
    await expect(menuTrigger(page, 'Ana S.')).toBeVisible()
    await other.close()
  })
})

test.describe('other tabs (AUTH-18)', () => {
  test('a sign-out in one tab ends the session in the other', async ({ page, isMobile }) => {
    await loginAs(page, 'ana')
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible()

    const other = await page.context().newPage()
    await other.goto('/profile')
    await expect(other.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible()

    if (isMobile) {
      // No header menu on mobile: the storage change is what the other tab reacts to.
      await other.evaluate((key) => {
        localStorage.removeItem(key)
      }, SESSION_STORAGE_KEY)
    } else {
      await chooseFromMenu(other, 'Ana Souza', 'Sair')
    }

    await expect(toasts(page)).toContainText('Sua sessão foi encerrada em outra aba.')
    await expect(emailField(page)).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/profile')
    await other.close()
  })

  test('a sign-in as someone else in one tab is adopted in the other, with its own socket', async ({
    page,
  }) => {
    await loginAs(page, 'ana')
    await page.goto('/')
    await waitForConnection(page, { userId: 'usr_ana' })

    const other = await page.context().newPage()
    await other.goto('/')
    const bruno = await loginAs(other, 'bruno', { seed: false })
    expect(bruno).toBeTruthy()
    const payload = await apiLoginPayload(other, 'bruno')
    await other.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, value)
      },
      [SESSION_STORAGE_KEY, payload] as const,
    )

    // The first tab follows the storage change: its socket is now Bruno's.
    await expect
      .poll(async () => (await realtime(page).connections()).map((c) => c.userId))
      .toContain('usr_bruno')
    await other.close()
  })
})

/** The login response as the app stores it, for tests that write the session by hand. */
async function apiLoginPayload(page: Page, name: CredentialName): Promise<string> {
  const { email, password } = CREDENTIALS[name]
  return page.evaluate(
    async ([creds]) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      })
      return response.text()
    },
    [{ email, password }] as const,
  )
}

test.describe('unavailable actions (AUTH-20)', () => {
  test('social login and "Esqueceu a senha?" only say "Disponível em breve"', async ({ page }) => {
    await openLogin(page)
    await waitForMock(page)
    await mock(page).clearRequests()

    const actions: Locator[] = [
      page.getByRole('button', { name: 'Continuar com Google' }),
      page.getByRole('button', { name: 'Continuar com Facebook' }),
      page.getByRole('link', { name: 'Esqueceu a senha?' }),
    ]
    for (const action of actions) {
      await expect(action).toHaveAttribute('aria-disabled', 'true')
      // `force`: the control is `aria-disabled`, which Playwright treats as not clickable.
      await action.click({ force: true })
      await expect(toasts(page).getByText('Disponível em breve')).toBeVisible()
      await expect(page).toHaveURL('/login')
    }
    await actions[0]?.focus()
    await page.keyboard.press('Enter')
    await expect(toasts(page).getByText('Disponível em breve')).toBeVisible()

    expect(await storedSession(page)).toBeNull()
    const authCalls = (await mock(page).requests()).filter((entry) => entry.op.startsWith('auth.'))
    expect(authCalls).toEqual([])
  })
})

test.describe('keyboard and accessibility (AUTH-22)', () => {
  test('tab order on /login follows the visual order, and Enter submits', async ({
    page,
    isMobile,
  }) => {
    await openLogin(page)
    if (!isMobile) {
      await page.getByRole('link', { name: 'Fechar' }).focus()
      await page.keyboard.press('Tab')
      expect(await focusedName(page)).toBe('Entrar')
      await page.keyboard.press('Tab')
      expect(await focusedName(page)).toBe('Criar conta')
      await page.keyboard.press('Tab')
    } else {
      await emailField(page).focus()
    }
    await expect(emailField(page)).toBeFocused()

    const order: string[] = []
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab')
      order.push(await focusedName(page))
    }
    expect(order).toEqual([
      'Digite sua senha',
      'Mostrar senha',
      'Esqueceu a senha?',
      'Entrar',
      'Continuar com Google',
      'Continuar com Facebook',
    ])

    await emailField(page).fill(CREDENTIALS.ana.email)
    await passwordField(page).fill(CREDENTIALS.ana.password)
    await passwordField(page).press('Enter')
    await expect(page).toHaveURL('/')
  })

  test('both pages have one h1, a title and labelled fields', async ({ page, isMobile }) => {
    await openLogin(page)
    await expect(page).toHaveTitle('Entrar · KURIO')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar')

    await openSignup(page)
    await expect(page).toHaveTitle('Criar conta · KURIO')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      isMobile ? 'Criar perfil de colecionador' : 'Criar conta',
    )
  })

  test('errors are linked to their fields with aria-describedby', async ({ page }) => {
    await openSignup(page)
    await signupButton(page).click()
    const username = usernameField(page)
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await username.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const text = await page.locator(`[id="${describedBy ?? ''}"]`).textContent()
    expect(text).toContain('Informe um nome de usuário.')
  })

  test('/login has no serious axe violations, empty and with errors', async ({ page }) => {
    await openLogin(page)
    await expectNoAxeViolations(page)
    await loginButton(page).click()
    await expect(fieldErrors(page)).toHaveCount(2)
    await expectNoAxeViolations(page)
  })

  test('/login with the expired notice and an alert has no serious axe violations', async ({
    page,
  }) => {
    await openLogin(page, '?reason=expired')
    await expect(page.getByText(EXPIRED)).toBeVisible()
    await emailField(page).fill(CREDENTIALS.ana.email)
    await passwordField(page).fill('senha-errada-1')
    await loginButton(page).click()
    await expect(main(page).getByRole('alert')).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('/signup has no serious axe violations, empty and with errors', async ({ page }) => {
    await openSignup(page)
    await expectNoAxeViolations(page)
    await signupButton(page).click()
    await expect(fieldErrors(page)).toHaveCount(4)
    await expectNoAxeViolations(page)
  })
})

test('the form layer validates on blur, then on change after a failed submit (AUTH-01)', async ({
  page,
}) => {
  await page.goto('/dev/ui-kit')
  const form = page.getByRole('form', { name: 'Exemplo de formulário' })
  const name = form.getByLabel('Nome', { exact: true })
  const error = form.locator('[data-slot="field-error"]')

  await name.fill('ab')
  await expect(error).toHaveCount(0)
  await name.blur()
  await expect(error).toHaveText('Use pelo menos 3 caracteres.')

  await form.getByRole('button', { name: 'Enviar exemplo' }).click()
  await expect(error).toHaveCount(2)
  await name.fill('abc')
  await expect(error).toHaveCount(1)
  await form.getByLabel('Senha de exemplo', { exact: true }).fill('12345678')
  await expect(error).toHaveCount(0)

  await form.getByRole('button', { name: 'Enviar exemplo' }).click()
  await expect(page.getByText('Exemplo enviado: nada sai do navegador.')).toBeVisible()
})
