/** Session as the shell sees it (spec 04 maps the real session to this). */
export type ShellSession =
  { status: 'guest' } | { status: 'user'; name: string; avatarUrl?: string | undefined }
