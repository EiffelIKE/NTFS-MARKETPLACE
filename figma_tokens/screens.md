# Screens from screenshots

Notes read from the full-page PNG exports in [`screenshots/`](screenshots/) (delivered 2026-10-27, 1× — desktop 1440 wide, mobile 414 × 896). These frames could not be extracted through the MCP, so values here are **read from pixels**: sizes are approximate (±2 px) and colors are matched to the nearest token in `tokens.json`. Owner specs re-check details against the PNG when they reach `design.md`.

Home desktop/mobile and details desktop are documented in `desktop/home.md`, `mobile/home.md` and `desktop/nft-details.md`; the screenshots confirm them, with the additions below.

| Screen | Desktop | Mobile | Owner spec |
|---|---|---|---|
| Home | `desktop/Início.png` | `mobile/Início.png` | 05 |
| NFT details | `desktop/Detalhes do NFT.png` | `mobile/Detalhes do NFT.png` | 06 |
| Cart | `desktop/Carrinho de NFTs.png` | `mobile/Carrinho de NFTs.png` | 07 |
| Checkout | `desktop/Pagamento.png` | `mobile/Pagamento.png` | 09 |
| Order confirmation | `desktop/Confirmação de Pedido.png` | — | 10 |
| Login | `desktop/Login.png` | `mobile/Login.png` | 04 |
| Sign-up | `desktop/Cadastro.png` | `mobile/Cadastro.png` | 04 |
| Profile | `desktop/Perfil do Colecionador.png` | — | 08 |
| Wallets | `desktop/Carteiras.png` | — | 08 |

## Shared observations

- **Header** on every desktop frame; `Início` active on home, login, sign-up, profile and wallets; `Mercado` active on details, cart and checkout. Badge shows `6`.
- **Footer** (cart, checkout, home, details) — copy recorded in spec 01 design §8. Social networks: Facebook, Instagram, Twitter, LinkedIn, YouTube.
- **Breadcrumb** "Início / Mercado / <screen>" (bold, foreground, 14) on cart and checkout; details shows only "Início / Mercado".
- **Mobile inner screens** (details, cart, checkout) have no tab bar: a 40 circular back button (`surface-card`) top-left, a bold ~18 title, and a fixed bottom area with the primary action (gradient `primary-soft` pill button, radius ~20, full width).
- **Dialog pattern** (login, sign-up, confirmation): `surface-card` panel ~500–580 wide, thin × close top-right in `primary`, and a 10 px `primary` bar along the bottom edge.
- **Card hover actions** (home grid, Sage Nomad #009): three 34 square icon buttons (cart, heart, search) on `ink`, overlapping the bottom of the media box.

## Login and sign-up

**Desktop** — a modal over the home page (no separate page), ~500 wide, top 160:
- Tabs "Entrar | Criar conta" (18, active in `text-accent`, inactive foreground, separated by a 1 px `primary` rule).
- Copy: login "Entre para gerenciar sua carteira, coleção e perfil de criador."; sign-up "Crie seu perfil de colecionador e conecte uma carteira quando quiser." (13, centered).
- Fields 340 × 40, `ink` background, 1 px `border`, placeholder `secondary`; focused field has a 1 px `primary` border.
  - Login: e-mail (placeholder "contato@email.com"), password with eye-off toggle; "Esqueceu a senha?" link right-aligned (`text-accent`, 13).
  - Sign-up: "Nome de usuário", "Digite seu e-mail", "Senha" (toggle), "Confirmar senha".
- Primary button full width 340 × 44: "Entrar" / "Criar conta".
- Divider with "Ou continue com", then two outline buttons 340 × 40: Google mark + "Continuar com Google", Facebook mark + "Continuar com Facebook".

**Mobile** — full page, no top bar or tab bar: "KURIO" logo (bold ~30, centered, top ~150), title "Entrar" / "Criar perfil de colecionador", fields 358 × 50 radius ~10, primary button 358 × 60 radius ~10 ("Entrar" / "Criar perfil"), same social buttons, footer link "Novo na Kurio? Crie uma conta" / "Já tem uma conta? Entre" (`text-secondary`).

Out of scope behaviors visible: "Esqueceu a senha?", social login (must not fake success).

## NFT details — mobile

- Top: back button left, favorite button right (both 40 circles), no title.
- Artwork ~360 wide, radius ~20, edge to edge minus 28 gutters; content sheet overlaps the image bottom (`surface-card`, top radius ~30).
- Title "Emerald Ape #042" (bold ~20) + rating chip (star + "4.8(19)", 1 px `primary` border, pill).
- Description (14/22 `text-secondary`): "Um colecionável digital 1/50 finalizado à mão da coleção Kurio Editions, verificado na Ethereum."
- "Edição:" chips (pill, 1 px `border-soft`; selected 1/50 has `primary` border + accent text). Figma shows "1/10" twice — a design typo; use 1/1, 1/10, 1/50, ABERTA.
- Meta lines: "ID do token: #0042", "Coleção: Kurio Apes", "Atributos: Óculos, Esmeralda, Raro" (`text-secondary`).
- Fixed bottom bar: "Qtd." stepper (primary rounded squares 22 with − / +), price "1.19 ETH" (accent bold 20) right; "Comprar NFT" gradient pill (196 × 60) + 60 circle cart button.

## NFT details — desktop (additions to `desktop/nft-details.md`)

- Main image has a search/zoom button (32 circle, `ink`) top-right — not the favorite chip.
- Rating: 5 stars (`primary`) + "19 avaliações de colecionadores".
- "Sobre este NFT:" copy: "Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores."
- Editions: 1/1, 1/10, 1/50 (selected: `primary` border, accent text), ABERTA.
- Stepper: two 31 × 49 `primary` pills with ink − / +, value between.
- "COMPRAR" (primary filled 130 × 40) and "Favoritar" (outline `primary`, heart icon, accent text).
- Share row "Compartilhar este NFT:" with LinkedIn, mail and Twitter icons in foreground.
- Tab "Detalhes do NFT" body, two paragraphs: "Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras." / "A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade."
- Specs: "Rede:" "Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS."; "Contrato:" "Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis."; "Direitos autorais:" "0x7A42...19E8 • Contrato inteligente ERC-721 verificado." — the last two values are still swapped (now in pt-BR).

## Cart

**Desktop:**
- Left (~780): table header "NFTs / Preço / Edições / Total" (bold 16, rule below). Rows 70 tall on `surface-card`, gap 12: 70² thumbnail, name (bold 16) + "ID do token: #0042" (13 `text-secondary`), unit price (accent 16), stepper (22 `primary` rounded squares + value), line total (accent bold), trash icon (`secondary`). Figma token ids are inconsistent across rows (design copy).
- Right (~330) "Resumo da carteira": "Código promocional" label, input "Digite o código promocional..." with attached "Aplicar" (primary); rows "Subtotal 26.83 ETH", "Desconto do lançamento (-) 00.00", "Taxa de rede 0.016 ETH" + caption "Taxa estimada" (accent 11); "Total 26.846 ETH" (accent bold); primary "Conectar e finalizar" full width; text link "Continuar explorando" (accent, centered).
- Below: "Colecionadores também viram" (accent bold 16, rule) + 5 cards (same as details related row) + carousel dots.

**Mobile:** inner top bar "Carrinho de NFTs". Cards (`surface-card`, radius ~16, 100² image flush left): name bold, "Edição: 1/50" (`text-secondary`), line price (accent bold 18), stepper on the right (minus disabled at 1 shows dimmed). A trash icon overlaps the plus on Ivory Baron (Figma glitch; swipe/remove action to define in spec 07). Fixed bottom sheet (`surface-card`, top radius ~30): coupon pill input + gradient "Aplicar", Subtotal / Desconto do lançamento / Taxa de rede (+ "Taxa estimada") / Total, gradient pill "Conectar e finalizar". Figma's subtotal (8.92) does not equal the lines (8.14) — design copy, ignored.

## Checkout ("Pagamento")

**Desktop:**
- Left form "Perfil do colecionador", two columns of fields 370 × 40 (labels 15 foreground, required marked with a `primary` "*"):
  - Nome de exibição* · Nome de usuário*
  - Rede* (select "Selecione uma rede") · Nome do perfil*
  - Endereço da carteira* ("Endereço 0x da carteira") · (no label) "ENS ou carteira secundária (opcional)"
  - Tipo de carteira* (select "Selecione uma carteira") · Código de indicação*
  - E-mail* · Nome ENS* (select ".eth" + implied name field)
  - Radio "Usar outra carteira?"
  - "Observação do colecionador (opcional)" textarea 350 × 150.
- Right (~405) "Seus NFTs": header "NFTs / Subtotal", rows (image, name, token id, "(x 2)", line total accent), link "Tem um código promocional? Aplique aqui", Subtotal / Desconto do lançamento / Taxa de rede + "Taxa estimada", Total (accent), then "Carteira e rede" radio list (cards 405 × 45, 1 px `border`; selected 1 px `foreground` border + filled radio): [chip METAMASK • WALLETCONNECT • COINBASE], MetaMask, Coinbase Wallet. Primary "Confirmar compra" 405 × 44.

**Mobile ("Pagamento com carteira"):** "Carteira conectada" + link "Trocar carteira"; registered wallet cards (radio, title "Reserva" / "Principal", line 2 ENS or short address "nova.kurio.eth" / "0xA91F…E82C", line 3 "Rede Polygon" / "Rede principal Ethereum", ⋮ menu). "Carteira e rede": provider rows with 40 circle avatar ("W", "M", wallet icon) — WalletConnect, MetaMask, Coinbase Wallet (selected). "Total: 8.936 ETH". Gradient "Confirmar compra".

## Order confirmation (desktop only)

Modal ~580 wide centered on an empty `ink` page (top 166):
- `thank-you` illustration 80, "Seus NFTs agora estão na sua carteira" (bold 16 `text-secondary`).
- Band between two 1 px `primary` rules, 4 columns split by `primary` vertical rules: "ID da transação 0xA91F…E82C", "Data 29 Jul, 2026", "Total 26.846 ETH", "Carteira MetaMask".
- "Detalhes da transação": header "NFTs / Edições / Subtotal", rows (image 70, name, "ID do token", "(x 2)", accent total), "Taxa de rede 0.016 ETH", "Total 26.846 ETH" (accent).
- Note (`text-secondary`, centered): "Transação confirmada na Ethereum. A propriedade foi transferida para sua carteira conectada e registrada na rede."
- Primary "Ver no Etherscan" (186 × 48). Bottom `primary` bar.

## Profile ("Perfil do Colecionador", desktop only)

- Left menu 310 wide `surface-card`: title "Meu perfil" (bold 18); items with 18 icons, `text-accent` labels: Dados do perfil (active: 6 px `primary` bar on the left), Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte; rule; "Sair" (bold). Out of scope: Atividade, Ofertas, Arquivos baixados, Suporte.
- Form "Perfil do colecionador" (bold 16): Nome de exibição* · Nome de usuário*; E-mail* · Nome ENS* (".eth" select 78 + name field); Apelido da carteira* · Avatar (50 circle with `empty-image` icon, primary "Alterar", text "Remover").
- "Alterar senha": Senha atual, Nova senha, Confirmar nova senha (each with eye-off toggle, 417 wide).
- Primary "Salvar" 131 × 40 (one button for the whole page).

## Wallets ("Carteiras", desktop only)

- Same left menu, "Carteiras" active.
- "Carteira principal" + caption "Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados." + link "Adicionar" (accent, right).
- Same field grid as the checkout form, without the textarea: Nome de exibição* · Apelido da carteira*; Rede* · Nome do perfil*; Endereço da carteira* · ENS ou carteira secundária (opcional); Tipo de carteira* · Código de indicação*; E-mail* · Nome ENS*. Primary "Salvar carteira".
- "Carteira secundária" + radio "Igual à carteira principal" + link "Adicionar"; empty state "Você ainda não adicionou uma carteira secundária."
