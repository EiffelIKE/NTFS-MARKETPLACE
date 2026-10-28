/** Session as the shell sees it; spec 04 provides the real value. */
export type ShellSession =
  { status: 'guest' } | { status: 'user'; name: string; avatarUrl?: string }
