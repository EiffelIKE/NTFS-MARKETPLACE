/**
 * Favorites query keys. The user is part of the key (spec 06 amendment, G5): a list never shows up
 * for another identity even before the cache is cleared on a user switch, as with the cart's keys.
 */
export const favoritesKeys = {
  all: ['favorites'] as const,
  list: (userId: string) => ['favorites', userId] as const,
}
