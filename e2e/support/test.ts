import { expect, test as base } from '@playwright/test'

export { expect }

/**
 * `test` that fails on any browser console error or uncaught page error (spec 01 T16), which is
 * how a missing `DialogTitle` or a React warning-turned-error surfaces. Opt out per suite with
 * `test.use({ allowedConsoleErrors: [/pattern/] })`.
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- Playwright's fixture type for `auto` fixtures without a value
export const test = base.extend<{ allowedConsoleErrors: RegExp[]; failOnConsoleError: void }>({
  allowedConsoleErrors: [[], { option: true }],
  failOnConsoleError: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = []
      const record = (text: string) => {
        if (!allowedConsoleErrors.some((pattern) => pattern.test(text))) errors.push(text)
      }
      page.on('console', (message) => {
        if (message.type() === 'error') record(message.text())
      })
      page.on('pageerror', (error) => {
        record(error.message)
      })
      await use()
      expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})
