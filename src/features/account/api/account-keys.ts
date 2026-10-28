/**
 * Account query keys (spec 08 design §3). The user is part of every key, so one user's profile or
 * wallets never show for another even before the cache is cleared on a user switch.
 */
export const accountKeys = {
  profile: (userId: string) => ['account', userId, 'profile'] as const,
  wallets: (userId: string) => ['account', userId, 'wallets'] as const,
}
