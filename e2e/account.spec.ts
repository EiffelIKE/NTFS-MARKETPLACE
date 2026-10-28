import path from 'node:path'

import type { Locator, Page } from '@playwright/test'

import { CREDENTIALS } from '../src/mocks/fixtures/credentials'
import { expectNoAxeViolations } from './support/a11y'
import { expectNoHorizontalOverflow } from './support/layout'
import { apiFetch, bearer, loginAs, mock, SESSION_STORAGE_KEY } from './support/mock'
import { expect, test } from './support/test'

// Spec 08 design §10 (brief §9 scenario 8): profile, avatar, password and wallets through the real
// forms and the mock API, in both projects. Rejections are the point of several tests, and the
// browser logs each 4xx.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const FIXTURES = path.join(import.meta.dirname, 'fixtures')
const PNG = path.join(FIXTURES, 'avatar.png')
const GIF = path.join(FIXTURES, 'avatar.gif')

const main = (page: Page) => page.getByRole('main')
const toasts = (page: Page) => page.getByRole('region', { name: /Notificações/ })
const fieldErrors = (page: Page) => main(page).locator('[data-slot="field-error"]')

// Labels carry a hidden "(obrigatório)", so fields are found by a label prefix.
const label = (text: string) => new RegExp(`^${text}`)
const displayName = (page: Page) => main(page).getByLabel(label('Nome de exibição'))
const username = (page: Page) => main(page).getByLabel(label('Nome de usuário'))
const email = (page: Page) => main(page).getByLabel(label('E-mail'))
const ensName = (page: Page) => main(page).getByLabel(label('Nome ENS'))
const nickname = (page: Page) => main(page).getByLabel(label('Apelido da carteira'))
const currentPassword = (page: Page) => main(page).getByLabel(label('Senha atual'))
const newPassword = (page: Page) => main(page).getByLabel(label('Nova senha'))
const confirmPassword = (page: Page) => main(page).getByLabel(label('Confirmar nova senha'))
const save = (page: Page) => main(page).getByRole('button', { name: 'Salvar', exact: true })
const fileInput = (page: Page) => main(page).locator('input[type="file"]')
const avatarImage = (page: Page) => main(page).getByRole('img', { name: 'Foto de perfil' })
const menuTrigger = (page: Page, name: string) =>
  page.getByRole('button', { name: `Conta de ${name}` })

const primary = (page: Page) => page.getByRole('region', { name: 'Carteira principal' })
const secondary = (page: Page) => page.getByRole('region', { name: 'Carteira secundária' })
const saveWallet = (slot: Locator) => slot.getByRole('button', { name: 'Salvar carteira' })

async function openProfile(page: Page, as: 'ana' | 'bruno' | 'carla' = 'ana') {
  await loginAs(page, as)
  await page.goto('/profile')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' }),
  ).toBeVisible()
  await expect(displayName(page)).not.toHaveValue('')
}

async function openWallets(page: Page, as: 'ana' | 'bruno' | 'carla') {
  await loginAs(page, as)
  await page.goto('/wallets')
  await expect(primary(page)).toBeVisible()
}

async function storedUser(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as { user: Record<string, unknown> }).user : null
  }, SESSION_STORAGE_KEY)
}

async function calls(page: Page, op: 'profile.update' | 'profile.uploadAvatar' | 'wallets.create') {
  return mock(page).requests({ op })
}

async function choose(page: Page, slot: Locator, field: string, option: string) {
  await slot.getByRole('combobox', { name: label(field) }).click()
  await page.getByRole('option', { name: option }).click()
}

/** A syntactically valid EVM address that no fixture uses. */
const NEW_EVM = `0x${'1f'.repeat(20)}`

test.describe('access and menu (ACC-01, ACC-02)', () => {
  test('a visitor is sent to login and returns to /profile after signing in', async ({ page }) => {
    await page.goto('/profile')
    await expect(main(page).getByLabel('E-mail', { exact: true })).toBeVisible()
    const login = new URL(page.url())
    expect(login.pathname).toBe('/login')
    expect(login.searchParams.get('redirect')).toBe('/profile')

    await main(page).getByLabel('E-mail', { exact: true }).fill(CREDENTIALS.ana.email)
    await main(page).getByLabel('Senha', { exact: true }).fill(CREDENTIALS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/profile')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' }),
    ).toBeVisible()
  })

  test('the account menu marks the current item and keeps unavailable ones unavailable', async ({
    page,
  }) => {
    await openProfile(page)
    const nav = page.getByRole('navigation', { name: 'Conta' })
    await expect(nav.getByRole('link', { name: 'Dados do perfil' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('link', { name: 'Carteiras' })).toHaveAttribute('href', '/wallets')
    await expect(nav.getByRole('link', { name: 'Lista de interesse' })).toHaveAttribute(
      'href',
      '/?favorites=1',
    )
    for (const name of ['Atividade', 'Ofertas', 'Arquivos baixados', 'Suporte']) {
      const item = nav.getByRole('link', { name })
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      await item.click({ force: true })
      await expect(toasts(page).getByText('Disponível em breve')).toBeVisible()
      await expect(page).toHaveURL('/profile')
    }

    await nav.getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL('/wallets')
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeAttached()
  })

  test('"Sair" is in the profile screen, on every width (ACC-02)', async ({ page }) => {
    await openProfile(page)
    await page
      .getByRole('navigation', { name: 'Conta' })
      .getByRole('button', { name: 'Sair' })
      .click()
    await expect(page).toHaveURL('/')
    await expect(toasts(page)).toContainText('Você saiu da sua conta.')
    expect(await storedUser(page)).toBeNull()
  })
})

test.describe('profile details (ACC-03 – ACC-06)', () => {
  test('shows the saved values, saves a change, updates the header and survives a refresh', async ({
    page,
    isMobile,
  }) => {
    await openProfile(page)
    await expect(displayName(page)).toHaveValue('Ana Souza')
    await expect(username(page)).toHaveValue('anasouza')
    await expect(email(page)).toHaveValue('ana@kurio.example')
    await expect(ensName(page)).toHaveValue('ana')
    await expect(nickname(page)).toHaveValue('Carteira principal')
    if (!isMobile) await expect(menuTrigger(page, 'Ana Souza')).toBeVisible()

    await displayName(page).fill('Ana S.')
    await save(page).click()
    await expect(toasts(page)).toContainText('Perfil atualizado.')
    expect(await storedUser(page)).toMatchObject({ displayName: 'Ana S.' })
    if (!isMobile) await expect(menuTrigger(page, 'Ana S.')).toBeVisible()
    expect(await calls(page, 'profile.update')).toHaveLength(1)

    await page.reload()
    await expect(displayName(page)).toHaveValue('Ana S.')
    if (!isMobile) await expect(menuTrigger(page, 'Ana S.')).toBeVisible()
  })

  test('an untouched form sends nothing', async ({ page }) => {
    await openProfile(page)
    await save(page).click()
    await expect(toasts(page)).toContainText('Nenhuma alteração para salvar.')
    expect(await calls(page, 'profile.update')).toEqual([])
  })

  test('the API conflicts land on their fields, keep the values and focus the field (ACC-05)', async ({
    page,
  }) => {
    await openProfile(page)
    await username(page).fill('brunolima')
    await email(page).fill('novo@kurio.example')
    await save(page).click()
    await expect(main(page).getByText('Este nome de usuário já está em uso.')).toBeVisible()
    await expect(username(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(username(page)).toBeFocused()
    await expect(email(page)).toHaveValue('novo@kurio.example')

    await username(page).fill('anasouza')
    await email(page).fill(CREDENTIALS.carla.email)
    await save(page).click()
    await expect(main(page).getByText('Este e-mail já está cadastrado.')).toBeVisible()
    await expect(email(page)).toBeFocused()
    await expect(username(page)).toHaveValue('anasouza')

    // Editing the field clears its message.
    await email(page).fill('outro@kurio.example')
    await expect(main(page).getByText('Este e-mail já está cadastrado.')).toBeHidden()
  })

  test('a new account must fill ENS name and nickname: errors, nothing sent (ACC-04)', async ({
    page,
  }) => {
    await openProfile(page, 'bruno')
    await expect(ensName(page)).toHaveValue('')
    await save(page).click()

    await expect(fieldErrors(page)).toHaveCount(2)
    await expect(ensName(page)).toBeFocused()
    await expect(ensName(page)).toHaveAttribute('aria-invalid', 'true')
    expect(await calls(page, 'profile.update')).toEqual([])

    await username(page).fill('Bruno Lima')
    await expect(main(page).getByText('Use apenas letras minúsculas, números e _.')).toBeVisible()
    await username(page).fill('brunolima')
    await ensName(page).fill('bruno')
    await nickname(page).fill('Carteira do Bruno')
    await save(page).click()
    await expect(toasts(page)).toContainText('Perfil atualizado.')
    expect(await calls(page, 'profile.update')).toHaveLength(1)
  })

  test('repeated clicks send one request (ACC-22)', async ({ page }) => {
    await openProfile(page)
    await mock(page).configure({ latency: { kind: 'fixed', ms: 800 } })
    await displayName(page).fill('Ana Dois')
    await save(page).click()
    await expect(save(page)).toHaveAttribute('aria-busy', 'true')
    await save(page).click({ force: true })
    await save(page).click({ force: true })
    await expect(toasts(page)).toContainText('Perfil atualizado.')
    expect(await calls(page, 'profile.update')).toHaveLength(1)
  })

  test('required fields say so in text, and the password fields use the right autocomplete (ACC-14, ACC-24)', async ({
    page,
  }) => {
    await openProfile(page)
    await expect(displayName(page)).toHaveAttribute('aria-required', 'true')
    await expect(main(page).getByText('(obrigatório)').first()).toBeAttached()
    await expect(currentPassword(page)).toHaveAttribute('autocomplete', 'current-password')
    await expect(newPassword(page)).toHaveAttribute('autocomplete', 'new-password')
    await expect(confirmPassword(page)).toHaveAttribute('autocomplete', 'new-password')
    await expect(currentPassword(page)).toHaveAttribute('type', 'password')
  })
})

test.describe('avatar (ACC-07 – ACC-09)', () => {
  test('uploads a PNG into the page and the header, then removes it', async ({
    page,
    isMobile,
  }) => {
    await openProfile(page)
    await expect(main(page).getByRole('button', { name: 'Remover' })).toBeDisabled()

    await fileInput(page).setInputFiles(PNG)
    await expect(toasts(page)).toContainText('Foto atualizada.')
    await expect(avatarImage(page)).toHaveAttribute('src', /^data:image\/webp/)
    expect(await storedUser(page)).toMatchObject({ avatarUrl: expect.stringMatching(/^data:/) })
    if (!isMobile) {
      await expect(menuTrigger(page, 'Ana Souza').locator('img')).toHaveAttribute('src', /^data:/)
    }
    expect(await calls(page, 'profile.uploadAvatar')).toHaveLength(1)

    await page.reload()
    await expect(avatarImage(page)).toBeVisible()

    await main(page).getByRole('button', { name: 'Remover' }).click()
    await expect(toasts(page)).toContainText('Foto removida.')
    await expect(avatarImage(page)).toHaveCount(0)
    await expect(main(page).getByRole('button', { name: 'Remover' })).toBeDisabled()
    await expect(main(page).getByRole('button', { name: 'Alterar' })).toBeFocused()
    expect(await storedUser(page)).toMatchObject({ avatarUrl: null })
  })

  test('a GIF and a file over 2 MB are refused on the client, without a request', async ({
    page,
  }) => {
    await openProfile(page)
    await fileInput(page).setInputFiles(GIF)
    await expect(main(page).getByText('Envie uma imagem PNG, JPEG ou WebP.')).toBeVisible()

    await fileInput(page).setInputFiles({
      name: 'grande.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    })
    await expect(main(page).getByText('A imagem deve ter no máximo 2 MB.')).toBeVisible()
    expect(await calls(page, 'profile.uploadAvatar')).toEqual([])
  })

  test('an API rejection shows its message and keeps the previous avatar', async ({ page }) => {
    await openProfile(page)
    await fileInput(page).setInputFiles(PNG)
    await expect(toasts(page)).toContainText('Foto atualizada.')
    const before = await avatarImage(page).getAttribute('src')

    await mock(page).addRule({
      op: 'profile.uploadAvatar',
      effect: { kind: 'http', status: 413, code: 'PAYLOAD_TOO_LARGE' },
      times: 1,
    })
    await fileInput(page).setInputFiles(PNG)
    await expect(main(page).getByText('A imagem deve ter no máximo 2 MB.')).toBeVisible()
    await expect(avatarImage(page)).toHaveAttribute('src', before ?? '')
    expect((await storedUser(page))?.avatarUrl).toBe(before)

    await mock(page).addRule({
      op: 'profile.uploadAvatar',
      effect: { kind: 'http', status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' },
      times: 1,
    })
    await fileInput(page).setInputFiles(PNG)
    await expect(main(page).getByText('Envie uma imagem PNG, JPEG ou WebP.')).toBeVisible()
  })
})

test.describe('password (ACC-10 – ACC-14)', () => {
  test('is optional, and once started all three fields are required', async ({ page }) => {
    await openProfile(page)
    await newPassword(page).fill('Outra12345')
    await save(page).click()
    await expect(fieldErrors(page)).toHaveCount(2)
    await expect(currentPassword(page)).toBeFocused()
    await currentPassword(page).fill(CREDENTIALS.ana.password)
    await confirmPassword(page).fill('Outra123456')
    await save(page).click()
    await expect(main(page).getByText('As senhas não coincidem.')).toBeVisible()
    await expect(confirmPassword(page)).toBeFocused()
    await newPassword(page).fill(CREDENTIALS.ana.password)
    await confirmPassword(page).fill(CREDENTIALS.ana.password)
    await expect(main(page).getByText('A nova senha deve ser diferente da atual.')).toBeVisible()
    expect(await mock(page).requests({ op: 'profile.changePassword' })).toEqual([])
  })

  test('a wrong current password shows on that field and keeps the values', async ({ page }) => {
    await openProfile(page)
    await currentPassword(page).fill('senha-errada-1')
    await newPassword(page).fill('Outra12345')
    await confirmPassword(page).fill('Outra12345')
    await save(page).click()
    await expect(main(page).getByText('Senha atual incorreta.')).toBeVisible()
    await expect(currentPassword(page)).toBeFocused()
    await expect(newPassword(page)).toHaveValue('Outra12345')
  })

  test('changing it keeps this session, ends the others and never stores the password', async ({
    page,
  }) => {
    await openProfile(page)
    const otherDevice = await loginAs(page, 'ana', { seed: false })

    await currentPassword(page).fill(CREDENTIALS.ana.password)
    await newPassword(page).fill('Outra12345')
    await confirmPassword(page).fill('Outra12345')
    await save(page).click()
    await expect(toasts(page)).toContainText('Senha alterada. As outras sessões foram encerradas.')
    await expect(currentPassword(page)).toHaveValue('')
    await expect(newPassword(page)).toHaveValue('')
    await expect(confirmPassword(page)).toHaveValue('')

    // The other device's next request is refused; this tab still works.
    const refused = await apiFetch(page, '/profile', { headers: bearer(otherDevice) })
    expect(refused.status).toBe(401)
    // Enter submits too (and on phones the toast and the tab bar cover the button).
    await displayName(page).fill('Ana Tres')
    await displayName(page).press('Enter')
    await expect(toasts(page)).toContainText('Perfil atualizado.')

    const relogin = (password: string) =>
      apiFetch(page, '/auth/login', {
        method: 'POST',
        body: { email: CREDENTIALS.ana.email, password },
      })
    expect((await relogin('Outra12345')).status).toBe(200)
    expect((await relogin(CREDENTIALS.ana.password)).status).toBe(401)

    const everything = await page.evaluate(() =>
      JSON.stringify({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.fromEntries(Object.entries(sessionStorage)),
        url: location.href,
      }),
    )
    expect(everything).not.toContain('Outra12345')
    expect(JSON.stringify(await mock(page).snapshot())).not.toContain('Outra12345')
  })

  test('profile saved and password refused: each outcome is reported on its own (ACC-13)', async ({
    page,
  }) => {
    await openProfile(page)
    await displayName(page).fill('Ana Parcial')
    await currentPassword(page).fill('senha-errada-1')
    await newPassword(page).fill('Outra12345')
    await confirmPassword(page).fill('Outra12345')
    await save(page).click()

    await expect(toasts(page)).toContainText('Perfil atualizado.')
    await expect(main(page).getByText('Senha atual incorreta.')).toBeVisible()
    await expect(fieldErrors(page)).toHaveCount(1)
    await expect(displayName(page)).not.toHaveAttribute('aria-invalid', 'true')

    await page.reload()
    await expect(displayName(page)).toHaveValue('Ana Parcial')
  })
})

test.describe('wallets (ACC-15 – ACC-20)', () => {
  test('Bruno: the primary is filled and the secondary offers to copy it', async ({ page }) => {
    await openWallets(page, 'bruno')
    await expect(main(page).getByText('Estas carteiras ficam disponíveis')).toBeVisible()
    await expect(primary(page).getByLabel(label('Apelido da carteira'))).toHaveValue(
      'Carteira do Bruno',
    )
    await expect(
      secondary(page).getByText('Você ainda não adicionou uma carteira secundária.'),
    ).toBeVisible()
    await expect(saveWallet(secondary(page))).toHaveCount(0)

    const same = secondary(page).getByRole('checkbox', { name: 'Igual à carteira principal' })
    await same.click()
    const form = secondary(page)
    await expect(form.getByLabel(label('Nome de exibição'))).toHaveValue('Bruno Lima')
    await expect(form.getByLabel(label('Nome do perfil'))).toHaveValue('Bruno L.')
    await expect(form.getByLabel(label('Código de indicação'))).toHaveValue('BRUNO-01')
    await expect(form.getByLabel(label('Rede'))).toHaveText('Polygon')
    await expect(form.getByLabel(label('Tipo de carteira'))).toHaveText('WalletConnect')
    await expect(form.getByLabel(label('Apelido da carteira'))).toHaveValue('')
    await expect(form.getByLabel(label('Endereço da carteira'))).toHaveValue('')

    // Unchecking removes what was copied and not edited.
    await form.getByLabel(label('Apelido da carteira')).fill('Reserva')
    await same.click()
    await expect(form.getByLabel(label('Nome de exibição'))).toHaveValue('')
    await expect(form.getByLabel(label('Apelido da carteira'))).toHaveValue('Reserva')
  })

  test('Bruno adds a secondary: duplicate, wrong network, then a valid one that persists', async ({
    page,
  }) => {
    await openWallets(page, 'bruno')
    const primaryAddress = await primary(page)
      .getByLabel(label('Endereço da carteira'))
      .inputValue()
    const slot = secondary(page)
    await slot.getByRole('checkbox', { name: 'Igual à carteira principal' }).click()
    await slot.getByLabel(label('Apelido da carteira')).fill('Reserva')
    await slot.getByLabel(label('Endereço da carteira')).fill(primaryAddress)
    await saveWallet(slot).click()
    await expect(slot.getByText('Este endereço já está em outra carteira sua.')).toBeVisible()
    await expect(slot.getByLabel(label('Endereço da carteira'))).toBeFocused()
    await expect(slot.getByLabel(label('Apelido da carteira'))).toHaveValue('Reserva')

    // An EVM address does not fit Solana, and the rule re-checks when the network changes.
    await slot.getByLabel(label('Endereço da carteira')).fill(NEW_EVM)
    await choose(page, slot, 'Rede', 'Solana')
    await expect(slot.getByText('Endereço inválido para a rede selecionada.')).toBeVisible()
    await expect(slot.getByLabel(label('Endereço da carteira'))).toHaveAttribute(
      'placeholder',
      'Endereço Solana da carteira',
    )
    await choose(page, slot, 'Rede', 'Polygon')
    await expect(slot.getByText('Endereço inválido para a rede selecionada.')).toBeHidden()

    // Only the duplicate reached the API; the wrong network was stopped on the client.
    expect(await calls(page, 'wallets.create')).toHaveLength(1)
    await saveWallet(slot).click()
    await expect(toasts(page)).toContainText('Carteira salva.')
    await expect(slot.getByRole('checkbox')).toHaveCount(0)

    await page.reload()
    await expect(secondary(page).getByLabel(label('Apelido da carteira'))).toHaveValue('Reserva')
    await expect(secondary(page).getByLabel(label('Endereço da carteira'))).toHaveValue(NEW_EVM)
    await expect(secondary(page).getByText('Você ainda não adicionou')).toHaveCount(0)
  })

  test('Ana edits her primary wallet and the change persists', async ({ page }) => {
    await openWallets(page, 'ana')
    const slot = primary(page)
    await slot.getByLabel(label('Apelido da carteira')).fill('Principal renomeada')
    await saveWallet(slot).click()
    await expect(toasts(page)).toContainText('Carteira salva.')
    await page.reload()
    await expect(primary(page).getByLabel(label('Apelido da carteira'))).toHaveValue(
      'Principal renomeada',
    )
    await expect(secondary(page).getByLabel(label('Apelido da carteira'))).toHaveValue(
      'Carteira Polygon',
    )
  })

  test('Carla: an empty primary form, no copy yet, then the slot switches to edit mode', async ({
    page,
  }) => {
    await openWallets(page, 'carla')
    const slot = primary(page)
    await expect(slot.getByLabel(label('Nome de exibição'))).toHaveValue('')
    await expect(
      secondary(page).getByRole('checkbox', { name: 'Igual à carteira principal' }),
    ).toBeDisabled()
    await expect(secondary(page).getByText('Cadastre a carteira principal primeiro.')).toBeVisible()

    await saveWallet(slot).click()
    await expect(slot.locator('[data-slot="field-error"]')).toHaveCount(9)
    await expect(slot.getByLabel(label('Nome de exibição'))).toBeFocused()
    expect(await calls(page, 'wallets.create')).toEqual([])

    await slot.getByLabel(label('Nome de exibição')).fill('Carla Mendes')
    await slot.getByLabel(label('Apelido da carteira')).fill('Minha carteira')
    await choose(page, slot, 'Rede', 'Ethereum')
    await slot.getByLabel(label('Nome do perfil')).fill('Carla M.')
    await slot.getByLabel(label('Endereço da carteira')).fill(NEW_EVM)
    await choose(page, slot, 'Tipo de carteira', 'MetaMask')
    await slot.getByLabel(label('Código de indicação')).fill('carla-01')
    await expect(slot.getByLabel(label('Código de indicação'))).toHaveValue('CARLA-01')
    await slot.getByLabel(label('E-mail')).fill('carla@kurio.example')
    await slot.getByLabel(label('Nome ENS')).fill('carla')
    await saveWallet(slot).click()

    await expect(toasts(page)).toContainText('Carteira salva.')
    expect(await calls(page, 'wallets.create')).toHaveLength(1)
    await expect(
      secondary(page).getByRole('checkbox', { name: 'Igual à carteira principal' }),
    ).toBeEnabled()
    // Saved: the next save is an update, not another create.
    await slot.getByLabel(label('Apelido da carteira')).fill('Minha carteira 2')
    await saveWallet(slot).click()
    await expect(slot.getByLabel(label('Apelido da carteira'))).toHaveValue('Minha carteira 2')
    await expect.poll(async () => (await calls(page, 'wallets.create')).length).toBe(1)
  })

  test('a second tab created the slot: the API refuses, the form shows the saved wallet (ACC-19)', async ({
    page,
  }) => {
    await openWallets(page, 'carla')
    const token = await loginAs(page, 'carla', { seed: false })
    const body = {
      role: 'primary',
      displayName: 'Carla Mendes',
      nickname: 'Da outra aba',
      network: 'ethereum',
      profileName: 'Carla M.',
      address: NEW_EVM,
      provider: 'metamask',
      referralCode: 'CARLA-01',
      email: 'carla@kurio.example',
      ensName: 'carla',
    }
    const created = await apiFetch(page, '/wallets', {
      method: 'POST',
      headers: bearer(token),
      body,
    })
    expect(created.status).toBe(201)

    const slot = primary(page)
    await slot.getByLabel(label('Nome de exibição')).fill('Carla Mendes')
    await slot.getByLabel(label('Apelido da carteira')).fill('Digitada aqui')
    await choose(page, slot, 'Rede', 'Polygon')
    await slot.getByLabel(label('Nome do perfil')).fill('Carla M.')
    await slot.getByLabel(label('Endereço da carteira')).fill(`0x${'2e'.repeat(20)}`)
    await choose(page, slot, 'Tipo de carteira', 'Coinbase Wallet')
    await slot.getByLabel(label('Código de indicação')).fill('CARLA-02')
    await slot.getByLabel(label('E-mail')).fill('carla@kurio.example')
    await slot.getByLabel(label('Nome ENS')).fill('carla')
    await saveWallet(slot).click()

    await expect(
      slot.getByText('Esta carteira já foi cadastrada. Atualizamos os dados.'),
    ).toBeVisible()
    await expect(slot.getByLabel(label('Apelido da carteira'))).toHaveValue('Da outra aba')
  })

  test('repeated clicks on "Salvar carteira" send one create (ACC-22)', async ({ page }) => {
    await openWallets(page, 'carla')
    await mock(page).configure({ latency: { kind: 'fixed', ms: 800 } })
    const slot = primary(page)
    await slot.getByLabel(label('Nome de exibição')).fill('Carla Mendes')
    await slot.getByLabel(label('Apelido da carteira')).fill('Minha carteira')
    await choose(page, slot, 'Rede', 'Ethereum')
    await slot.getByLabel(label('Nome do perfil')).fill('Carla M.')
    await slot.getByLabel(label('Endereço da carteira')).fill(NEW_EVM)
    await choose(page, slot, 'Tipo de carteira', 'MetaMask')
    await slot.getByLabel(label('Código de indicação')).fill('CARLA-01')
    await slot.getByLabel(label('E-mail')).fill('carla@kurio.example')
    await slot.getByLabel(label('Nome ENS')).fill('carla')

    await saveWallet(slot).click()
    await expect(saveWallet(slot)).toHaveAttribute('aria-busy', 'true')
    await saveWallet(slot).click({ force: true })
    await saveWallet(slot).click({ force: true })
    await expect(toasts(page)).toContainText('Carteira salva.')
    expect(await calls(page, 'wallets.create')).toHaveLength(1)
  })
})

test.describe('states and layout (ACC-21, ACC-23, ACC-24)', () => {
  test('slow network: field skeletons in a busy region, replaced at the same size', async ({
    page,
  }) => {
    await loginAs(page, 'ana')
    await mock(page).configure({ latency: { kind: 'fixed', ms: 2500 } })
    await page.clock.install()
    await page.goto('/profile')
    // The stored session is checked first (2.5 s), then the profile is read (2.5 s).
    await page.clock.runFor(2600)

    const region = page.locator('[aria-busy=true]').filter({ has: page.getByRole('status') })
    await expect(region.getByRole('status')).toHaveText('Carregando perfil')
    await expect(main(page).locator('[data-slot=skeleton]').first()).toBeVisible()
    await expect(displayName(page)).toHaveCount(0)
    const skeletonBox = await main(page).locator('[data-slot=skeleton]').first().boundingBox()

    await page.clock.runFor(6000)
    await expect(displayName(page)).toHaveValue('Ana Souza')
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
    const fieldBox = await displayName(page).boundingBox()
    // The first skeleton is the label; the field sits one label (22) and a gap (8) below it.
    expect(Math.abs((fieldBox?.x ?? 0) - (skeletonBox?.x ?? 99))).toBeLessThanOrEqual(1)
  })

  test.describe('load failure', () => {
    test.use({ allowedConsoleErrors: [/Failed to load resource|Serviço temporariamente/i] })

    test('an inline alert with "Tentar novamente" that recovers', async ({ page }) => {
      await loginAs(page, 'ana')
      await page.clock.install()
      await mock(page).addRule({
        op: 'wallets.list',
        effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
        times: 3,
      })
      await page.goto('/wallets')
      await page.clock.runFor(5000)
      const alert = main(page).getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
      await expect(alert).toBeVisible()
      await alert.getByRole('button', { name: 'Tentar novamente' }).click()
      await page.clock.runFor(500)
      await expect(primary(page)).toBeVisible()
      await expect(alert).toHaveCount(0)
    })
  })

  test('no horizontal scroll at 320, 390, 768 and 1440', async ({ page }) => {
    await loginAs(page, 'ana')
    for (const path of ['/profile', '/wallets']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
      await expect(page.getByRole('button', { name: /^Salvar/ }).first()).toBeVisible()
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await expectNoHorizontalOverflow(page)
      }
    }
  })

  test('the profile has no serious axe violations, empty-handed and with errors', async ({
    page,
  }) => {
    await openProfile(page, 'bruno')
    await expectNoAxeViolations(page)
    await save(page).click()
    await expect(fieldErrors(page)).toHaveCount(2)
    await expectNoAxeViolations(page)
  })

  test('the wallets have no serious axe violations, empty-handed and with errors', async ({
    page,
  }) => {
    await openWallets(page, 'bruno')
    await expectNoAxeViolations(page)
    await secondary(page).getByRole('checkbox', { name: 'Igual à carteira principal' }).click()
    await saveWallet(secondary(page)).click()
    await expect(secondary(page).locator('[data-slot="field-error"]').first()).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('the mobile profile is a menu and a form, and "Carteiras" opens an inner screen', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the mobile composition')
    await openProfile(page)
    const nav = page.getByRole('navigation', { name: 'Conta' })
    await expect(nav).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Perfil' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(save(page)).toBeVisible()

    await nav.getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL('/wallets')
    await expect(page.getByRole('navigation', { name: 'Conta' })).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0)
    await expect(primary(page)).toBeVisible()
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL('/profile')
  })

  test('the desktop frame: menu beside the form', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the desktop composition')
    await openProfile(page)
    const nav = await page.getByRole('navigation', { name: 'Conta' }).boundingBox()
    const name = await displayName(page).boundingBox()
    expect(nav?.width).toBeCloseTo(310, 0)
    expect((name?.x ?? 0) - ((nav?.x ?? 0) + (nav?.width ?? 0))).toBeGreaterThan(20)
  })
})
