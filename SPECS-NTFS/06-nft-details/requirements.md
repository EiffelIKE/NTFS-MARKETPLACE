# 06 — NFT details · Requirements

> Status: Ready for review

Build the NFT details screen at `/nfts/$nftId`: gallery, price and rating, edition selection, quantity limits, add to cart, favorites, the details and reviews tabs, and the related row. The screen opens directly, shows a dedicated 404 and follows live `nft.updated` changes. This spec also owns two features that the catalog cards reuse: the favorites toggle (optimistic with rollback) and add to cart.

Brief coverage: §3 (NFT details), §3.1 (direct access, nonexistent resources, unavailable editions, quantity limits, favorites persisted per user), §3.2 (add to cart, live price and availability), §4 (optimistic update with rollback, loading and error states, no duplicate operations), §7 (`nft.updated` on screen), §8 (Figma fidelity, mobile inner screen), §9 (E2E scenarios 2 and 4, part of 12).

## User stories

- **US-1** — As a collector, I open an NFT from the catalog or from a shared link, see its images, price, rating, editions and details, and pick an edition and a quantity within the limits.
- **US-2** — As a collector, I add the NFT to my cart (signed in or as a guest) and either continue to the cart or keep browsing.
- **US-3** — As a signed-in collector, I favorite and unfavorite NFTs instantly. If the server fails, the change is undone and I am told.
- **US-4** — As a collector looking at an NFT whose price or stock changes, I see the change without reloading and cannot add more than is available.
- **US-5** — As anyone opening a wrong link, I get a clear "NFT não encontrado" page with a way back.

## Acceptance criteria

### Route and loading

- **DET-01** — WHEN the user opens `/nfts/$nftId` directly, by reload or by in-app navigation, THE SYSTEM SHALL load the NFT with `nfts.get` and render the screen. The document title SHALL be `<name> · KURIO`.
- **DET-02** — WHEN `nfts.get` answers 404, or the id does not match the `NftId` format, THE SYSTEM SHALL render the "NFT não encontrado" view with a link "Voltar ao mercado", keep the URL, and title the page "NFT não encontrado · KURIO".
- **DET-03** — WHILE the NFT loads, THE SYSTEM SHALL show a skeleton of the details layout at final sizes. WHEN loading fails after retries for a reason other than 404, THE SYSTEM SHALL show an error message with "Tentar novamente", which retries without a page reload.
- **DET-04** — THE SYSTEM SHALL load the related items (`nfts.related`) independently of the main data, with their own skeleton. A failure there SHALL show an inline retry and SHALL NOT block the rest of the page.

### Content

- **DET-05** — THE SYSTEM SHALL show a gallery of the NFT's images:
  - Desktop: a main image plus up to four thumbnail buttons. Selecting a thumbnail swaps the main image and marks it selected.
  - Mobile: a swipeable image track with one indicator per image when there are several.
  - Both: a zoom button that opens the current image at full size in a dialog.
- **DET-06** — THE SYSTEM SHALL show:
  - name, price and the previous price when present;
  - rating: stars with a text alternative, "4.8" style value, and "<n> avaliações de colecionadores";
  - "Sobre este NFT:" description;
  - token id, collection and attributes;
  - the breadcrumb "Início / Mercado / <name>" on desktop.
- **DET-07** — THE SYSTEM SHALL show the tabs "Detalhes do NFT" and "Avaliações de colecionadores (<n>)":
  - details: the long description paragraphs and a description list "Rede / Contrato / Direitos autorais" with each value under its correct label;
  - reviews: the latest reviews returned (author, stars, date, comment), a "Mostrando <k> de <n> avaliações" note, or an empty message.
- **DET-08** — THE SYSTEM SHALL show "Mais desta coleção" with the related items as compact catalog cards linking to their details, and hide the section when there are none.
- **DET-09** — THE SYSTEM SHALL offer share links for LinkedIn, e-mail and Twitter that open the real share targets with the page URL, in a new tab for the web ones.

### Editions and quantity

- **DET-10** — THE SYSTEM SHALL present editions as a single-choice group in the fixed order of the response. Every edition sells at the NFT's price.
- **DET-11** — THE SYSTEM SHALL select by default the edition named in the `edition` search param when it is available, otherwise the first available edition. Changing the edition SHALL update the param, replacing the history entry.
- **DET-12** — WHEN an edition has `available === 0`, THE SYSTEM SHALL render it disabled with a non-color "Esgotada" cue. WHEN every edition is sold out, THE SYSTEM SHALL disable buying and show "Esgotado".
- **DET-13** — THE SYSTEM SHALL show for the selected edition how many remain (or "Edição aberta") and the per-order limit.
- **DET-14** — THE SYSTEM SHALL let the quantity range from 1 to the selected edition's addable maximum: `min(available, maxPerOrder)` minus what the user's cart already holds of that edition. The decrease and increase controls SHALL be disabled at the bounds. WHEN the addable maximum is 0 because the cart already holds the limit, THE SYSTEM SHALL disable adding and say so. Changing the edition SHALL clamp the quantity.

### Cart

- **DET-15** — WHEN the user activates "COMPRAR" (desktop) or "Comprar NFT" (mobile), THE SYSTEM SHALL add the selected edition and quantity with `cart.addItem` and then navigate to `/cart`. WHEN the user activates the mobile cart button, THE SYSTEM SHALL add the item and stay, confirming with a toast "Adicionado ao carrinho" that has a "Ver carrinho" action.
- **DET-16** — THE SYSTEM SHALL allow guests to add to the cart. The first guest add SHALL store the returned guest cart id for later requests.
- **DET-17** — WHILE an add request is pending, THE SYSTEM SHALL show the button's loading state and ignore further activations, so one click sends one request.
- **DET-18** — WHEN the add fails, THE SYSTEM SHALL:
  - on `EDITION_UNAVAILABLE`: refetch the NFT and say the edition sold out;
  - on `INSUFFICIENT_AVAILABILITY`: refetch, clamp the quantity to the new limit and say how many remain;
  - on other errors: show an error toast with "Tentar novamente".

  The cart cache and the header count SHALL change only on success.
- **DET-19** — WHEN an add succeeds, THE SYSTEM SHALL update the cart cache from the response, so the header cart count reflects it without another request.

### Favorites

- **DET-20** — WHEN a signed-in user toggles "Favoritar" (or a card's heart), THE SYSTEM SHALL flip the favorite state immediately, send `favorites.add` or `favorites.remove`, and keep the new state on success. The control SHALL expose its state ("Favoritar" / "Favoritado", pressed or not).
- **DET-21** — WHEN the favorite request fails, THE SYSTEM SHALL restore the previous state and show "Não foi possível atualizar seus favoritos." with "Tentar novamente". Rapid toggles on the same NFT SHALL be applied in order, and the final state SHALL match the server.
- **DET-22** — WHEN a guest activates a favorite control, THE SYSTEM SHALL navigate to `/login` with a `redirect` back to the current URL, and SHALL NOT show the item as favorited.
- **DET-23** — THE SYSTEM SHALL persist favorites per user through the API, so they survive reloads and do not appear for another account.

### Live updates

- **DET-24** — WHEN the NFT's data in the query cache changes through spec 03's `nft.updated` handling or a refetch, THE SYSTEM SHALL re-render price, edition availability and limits. It SHALL:
  - announce a price change politely ("Preço atualizado para <price>");
  - if the selected edition sold out, keep it selected but disabled, block adding and say so;
  - if the limit dropped below the chosen quantity, clamp the quantity and announce it.

### Catalog card actions and layout

- **DET-25** — THE SYSTEM SHALL fill the catalog card action slot (spec 05):
  - desktop: a heart (favorite toggle, DET-20 – DET-22) and a cart button that adds one unit of the default edition, with the DET-15 toast and the DET-18 handling;
  - mobile: the 28 heart in the corner.
- **DET-26** — THE SYSTEM SHALL use these layouts:
  - desktop: the Figma layout;
  - mobile: the inner screen (back button, favorite trailing button, image, overlapping content sheet, fixed bottom bar with quantity, price, "Comprar NFT" and the cart button);
  - 768–1023: the mobile composition, with the content constrained to 600 px and centered.
- **DET-27** — THE SYSTEM SHALL make every control keyboard operable with a pt-BR name:
  - edition chips are a radio group;
  - thumbnails are toggle buttons;
  - the quantity value is announced on change;
  - tabs follow the tablist pattern;
  - nothing is fixed-width beyond 320 px.

### Verification

- **DET-28** — THE SYSTEM SHALL include unit tests for edition defaults and quantity limits, and for the favorite cache updates and rollback, plus the E2E suites `e2e/nft-details.spec.ts` (scenario 2) and `e2e/favorites.spec.ts` (scenario 4), and the details part of `e2e/loading-states.spec.ts`, in both Playwright projects.

## Out of scope

- Writing reviews, viewing all reviews (only the ≤ 3 returned), and image zoom beyond the 1000 px variant.
- Cart screen, quantity editing in the cart, coupons and guest cart merge on login: spec 07. This spec only adds items and seeds the cart query and guest cart id store that spec 07 builds on.
- The `nft.updated` socket subscription and cache patching: spec 03. This spec reacts to the cache.
- Login itself and the session-expiry flow: spec 04.

## Open questions

Defaults are applied in `design.md`.

1. **"COMPRAR" behavior.** Default: add to cart, then go to `/cart` (the brief's purchase flow goes through the cart). The mobile cart button adds and stays. Alternative: both stay on the page with a toast.
2. **Favorite intent after login.** Default: the guest is redirected to login and comes back to the same NFT, but the favorite is not applied automatically, so nothing is changed on the user's behalf. Alternative: carry `?favorite=1` through the redirect and apply it after login.
