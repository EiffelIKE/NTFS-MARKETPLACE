# Assets to export from Figma

Export from file `di66cL89caut7ECDhUns79`.

## Status (2026-10-27)

Delivered by the user into `src/assets/`:

| Folder | Contents |
|---|---|
| `NFTs/250/`, `NFTs/750/`, `NFTs/1000/` | The four unique artworks (03 ape varsity, 04 gorilla bucket hat, 05 gorilla turtleneck, 10/11 ape headphones) in each width, rounded corners baked in. Key mapping in spec 02 design §9 |
| `icons/` | 29 SVGs: search, cart, logout (+ ink duplicate), arrow-left, arrow-right, filter, heart, heart-filled, minus, plus, home, shop, user, scan, delete, wallet, empty-image, thank-you, user-outlined, location, shopping-outlined, activity, download, danger-triangle, eye-off, star, star-filled, menu (⋮) |
| `social/` | facebook, instagram, twitter, linkedin, union (YouTube) — footer |
| `share_icons/` | linkedin, twitter, mail — details share row (cream variants, not the footer set) |
| `social_login/` | google, facebook (brand colors) |

Still needed: nothing. Figma has no open-eye icon; spec 01 derives it from `eye-off`.

Not needed (built in code): tab bar shape and FAB circle, carousel dots, hero/promo decorative masks (CSS gradients; the spec that builds them records any visible difference), favorite chip circle.

The tables below are the original export list, kept for node references.

Several artworks reuse the same image fill (identical hashes in the Figma payload), so only unique images need exporting.

## Raster — NFT artworks (Home desktop)

| Asset | Node(s) | Notes |
|---|---|---|
| Ape, green varsity jacket | `70342:2673` (hero 450²), `4:428` (promo), `4:137` | Same image fill as hero |
| Gorilla, bucket hat + purple hoodie | `4:162`, `4:280`, `4:282`, `70410:3798` | Featured banner uses 310 × 368 crop |
| Dark gorilla, turtleneck | `4:164`, `4:284`, `4:423`, `70343:259` | Same fill as blog card 1 image |
| Golden ape, headphones | `4:286`, `4:289`, `4:291` | |
| Blog images | `70343:259`, `70343:268`, `70343:277`, `70343:286` | 268 × 195 crops |

These will also seed the mock catalog fixtures; the catalog needs more items than images, so artworks will be reused across fixtures.

## Icons (SVG)

| Icon | Node | Size |
|---|---|---|
| Search | `I70522:3240;70504:3015;70486:519` | 20 |
| Cart | `I70522:3240;70504:3015;70486:521` | 24 |
| Iconly Curved / Logout (login button) | `I70522:3240;70504:3015;70486:527` | 20 |
| Iconly Two-tone / Arrow-Down 2 (sort) | `4:152` | 16 |
| Iconly Curved / Arrow-Right 2 (pagination) | `4:392` | 18 |
| Iconly Curved / Arrow-Right (promo CTA) | `5:99` | 18 |
| Social icons ×5 (footer) | `I70492:696;70491:1269` … `1277` | 30 |

## Mobile (Home `14:5226`)

| Asset | Node | Notes |
|---|---|---|
| Search icon | `15:5331` | 22 |
| Iconly Curved / Filter | `15:5488` | 22 |
| Favorite button (circle + heart outline) | `15:5465` | 28 |
| Tab bar background (notched) | `15:5504` | 414 × 95 |
| FAB circle | `15:5507` | 65 (or CSS gradient) |
| FAB glyph (scan/frame) | `15:5529` | ~27 × 24 |
| Iconly Bold / Home | `15:5519` | 20 |
| Heart (tab bar) | `15:5527` | 20 |
| Shop / Cart | `15:5524` | 20 |
| User | `15:5522` | 20 |
| Hero mask (gradient + circles) | `14:5290` | 366 × 190 |
| Hero thumb artwork (gorilla, bucket hat) | `14:5239` | Same fill as `4:162` |

## NFT details desktop (`10:244`)

| Asset | Node | Notes |
|---|---|---|
| Main artwork | `11:1161` | 404² |
| Thumbnails | `11:1181`, `11:1188`, `11:1189`, `11:1190` | 100² |
| Related artworks | `11:1177`, `11:1178`, `11:1179`, `11:1180`, `11:1182` | ~212² |
| Iconly / Bold / Star | `11:1195` | 15 |
| Heart (Favoritar button) | `70410:3940` | 20 |
| Favorite chip (circle + heart) | `70410:3937` | 30 |
| Stepper minus / plus | `70410:4191`, `70410:4195` | 26.4 |
| Share: LinkedIn, Twitter, Message | `11:1245`, `11:1247`, `11:1248` | 15–18 |

Image fills could not be compared (no design context), so some of these may duplicate the 4 known artworks.

## Decorative SVG

| Asset | Node | Notes |
|---|---|---|
| Hero background shape | `2:104` | 1200 × 450 |
| Promo mask circles | `5:134`, `5:130` | 586 × 250 |

## Implemented in code (no export needed)

Header divider, nav active underline, cart badge circle, carousel dots (`3:131`), price slider handles/track, footer vertical rules, pagination boxes.
