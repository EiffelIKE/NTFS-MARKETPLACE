# KURIO — NFT Marketplace

[English](README.md) · **Português (Brasil)**

Um marketplace de NFTs somente frontend para o desafio KURIO: catálogo com busca, filtros e ordenação, detalhes do NFT, favoritos, carrinho com cupons, checkout com carteira simulada, comprovante do pedido e um explorador de blocos simulado, perfil e carteiras, e atualizações em tempo real de preço, disponibilidade e pedidos via Socket.IO. React 19, TypeScript, TanStack Router e Query, Axios, Zod, MSW, Tailwind v4 com shadcn/ui, Playwright e Lighthouse. **Não há backend**: a API REST e o servidor Socket.IO são simulados no navegador (MSW), então o mesmo build roda em qualquer lugar, inclusive offline.

- **Demo online:** <https://ntfs-marketplace.vercel.app/>
- **Repositório:** <https://github.com/EiffelIKE/NTFS-MARKETPLACE>
- **Como é construído e por quê:** [`ARCHITECTURE.pt-BR.md`](ARCHITECTURE.pt-BR.md) (contratos, tempo real, política de cache, desvios do Figma e do enunciado, limitações). O registro de design, spec por spec, está em [`SPECS-NTFS/`](SPECS-NTFS/README.md) (em inglês).
- **English:** [`README.md`](README.md) e [`ARCHITECTURE.md`](ARCHITECTURE.md). O inglês é a versão de referência.

![Home do KURIO no desktop](docs/screenshots/home-desktop.png)

## Início rápido

Com o [mise](https://mise.jdx.dev) (instala o Node 24.11 e o pnpm 10.34.3 fixados no projeto):

```sh
mise install
pnpm install --frozen-lockfile
pnpm dev
```

Sem o mise: instale o Node 24.11 (`>=24.11 <25`), rode `corepack enable` para que o `packageManager` selecione o pnpm 10.34.3 e depois os dois últimos comandos. Abra <http://localhost:5173>. Os mocks vêm ligados por padrão; não há mais nada para subir. A primeira visita registra o Service Worker do mock (precisa de `localhost` ou HTTPS), então espere o catálogo aparecer.

Para rodar o build de produção localmente, use `pnpm build && pnpm preview` (<http://localhost:4173>).

### Contas de demonstração

Todos os dados são fictícios (`.example` é um domínio reservado, nenhum endereço chega a ninguém). As senhas ficam apenas aqui e nas fixtures de teste, não no bundle de produção.

| Conta | E-mail | Senha | Mostra |
|---|---|---|---|
| Ana Souza | `ana@kurio.example` | `Kurio#Ana2026` | perfil completo, duas carteiras, favoritos, um carrinho cheio, um pedido confirmado `ord_000001` (comprovante e explorador) |
| Bruno Lima | `bruno@kurio.example` | `Kurio#Bruno2026` | uma carteira, carrinho vazio; abrir o pedido da Ana dá 403 |
| Carla Mendes | `carla@kurio.example` | `Kurio#Carla2026` | sem carteiras: o checkout pede para cadastrar uma |

Ou crie sua própria conta em `/signup` (a senha precisa de 8+ caracteres com uma letra e um dígito). O caso de conflito no cadastro é se cadastrar com `ana@kurio.example`.

### Variáveis de ambiente

Copie `.env.example` para `.env.local` para alterá-las; todas têm valor padrão. Elas são validadas na inicialização (`src/lib/env-schema.ts`), então um erro de digitação falha rápido, com o nome da variável.

| Variável | Tipo | Padrão | Finalidade |
|---|---|---|---|
| `VITE_API_BASE_URL` | string não vazia | `/api` | URL base do REST. O MSW intercepta esse mesmo caminho, então um único build funciona com mock ou com uma API real |
| `VITE_API_TIMEOUT_MS` | inteiro positivo | `10000` | Timeout do Axios |
| `VITE_ENABLE_MOCKS` | `true` ou `false` | `true` | A API mock do MSW. Com `false`, o build não contém código de mock (não há backend real, então o padrão é `true`) |
| `VITE_REALTIME_URL` | URL absoluta | `wss://realtime.kurio.example` | Endpoint do Socket.IO (somente WebSocket). Com os mocks ligados, o MSW responde dentro da página; nada sai do navegador |
| `VITE_ENABLE_DEV_ROUTES` | `true` (somente em tempo de build) | desligado nos builds, ligado no `pnpm dev` | Mantém as páginas de apoio para desenvolvimento `/dev/ui-kit` e `/dev/realtime`. O build da Vercel as deixa de fora; o servidor web do Playwright liga a variável |

## Cenários e reset

O ambiente de mock tem cenários nomeados, cada um uma combinação reproduzível de dados, latência e falhas. Escolha um:

- **URL:** `/?scenario=<id>` em qualquer rota (o parâmetro é consumido e removido da barra de endereço). `/?reset=1` recarrega a seed do cenário ativo.
- **Painel:** `/?mockPanel=1` ou `Alt+Shift+M` abre "Simulação da API": lista de cenários, condições de rede (latência, offline, tempo real desligado), resultado do pagamento, reset de carteira e de dados.
- **Console:** `window.__mock`: `useScenario(id)`, `reset()`, `configure(patch)`, `addRule(rule)`, `clearRules()`, `expireSessions()`, `updateNft(id, patch)` (uma mudança de preço ou de estoque "no servidor"), `settleOrder(id, 'confirmed' | 'declined')`, `disconnectWallet()`, `realtime.drop() / restore() / redeliver(n) / inject(event)`, `requests()`, `snapshot()`.

A tabela de cenários abaixo é gerada a partir de `src/mocks/scenarios.ts` (`pnpm docs:update` a atualiza; `pnpm test` falha quando ela está desatualizada).

<!-- generated:scenarios -->

| Cenário | Nome no painel | Efeito | Seed |
|---|---|---|---|
| `?scenario=default` | Padrão | Tudo funciona, com latência de 120 ms. É o cenário da auditoria Lighthouse. | `default` |
| `?scenario=empty` | Catálogo vazio | Nenhum NFT no catálogo, para o estado de resultado vazio. | `empty-catalog` |
| `?scenario=slow` | Rede lenta | Toda resposta demora 2,5 s, para ver skeletons e estados de carregamento. | `default` |
| `?scenario=jitter` | Latência variável | Respostas entre 150 ms e 2,5 s, sempre na mesma sequência. | `default` |
| `?scenario=out-of-order` | Respostas fora de ordem | Na listagem de NFTs, a segunda chamada responde antes da primeira. | `default` |
| `?scenario=offline` | Sem conexão | Toda chamada falha como se não houvesse rede, e o tempo real fica indisponível. | `default` |
| `?scenario=errors-then-recover` | Falhas temporárias | Catálogo, detalhe, carrinho e destaques falham 3 vezes com 503 e depois voltam. | `default` |
| `?scenario=rate-limited` | Limite de requisições | A listagem de NFTs responde 429 (limite de requisições) 3 vezes e depois volta ao normal. | `default` |
| `?scenario=server-down` | Servidor indisponível | Toda chamada responde 500. | `default` |
| `?scenario=session-short` | Sessão curta | A sessão expira 60 s depois do login. | `default` |
| `?scenario=payment-declined` | Pagamento recusado | Pedidos são recusados 3 s depois de criados. | `default` |
| `?scenario=payment-manual` | Pagamento manual | Pedidos ficam pendentes até serem liquidados pelo painel ou por `__mock.settleOrder`. | `default` |
| `?scenario=pending-order` | Pedido pendente | A Ana já tem um pedido pendente, para testar a recuperação. | `pending-order` |
| `?scenario=order-timeout` | Timeout após criar pedido | A primeira criação de pedido é gravada, mas a resposta nunca chega. | `default` |
| `?scenario=price-change-on-checkout` | Preço muda no checkout | O preço do primeiro item do carrinho sobe 10% ao confirmar o pedido. | `default` |
| `?scenario=sold-out-on-checkout` | Esgota no checkout | O primeiro item do carrinho esgota ao confirmar o pedido. | `default` |
| `?scenario=wallet-reject` | Carteira recusa conexão | A conexão com a carteira é recusada. | `default` |

<!-- /generated:scenarios -->

**Reset.** Trocar de cenário recarrega o banco e limpa as sobrescritas (selecionar o cenário que já está ativo não faz nada: use o reset). Faça o reset com `/?reset=1`, com o reset de dados do painel ou com `__mock.reset()`; trocar de cenário ou fazer o reset exige recarregar a página e desconecta todo mundo (o mock descarta as sessões). **Persistência:** o banco e a configuração do mock ficam no `localStorage` deste navegador (`kurio.mock.db`, `kurio.mock.config`), então cada perfil de navegador tem os seus e um reload mantém suas alterações. Uma janela privada ou "Limpar dados do site" recomeça da seed.

## Reproduzindo fluxos de falha

Todo fluxo abaixo tem um teste E2E automatizado, listado na última coluna; os passos são o que fazer à mão. Os ids dos cenários estão na tabela acima. Entre como Ana, salvo indicação em contrário.

| Fluxo | Gatilho e passos | Esperado | E2E |
|---|---|---|---|
| Catálogo vazio | Abra `/?scenario=empty` | "Nenhum NFT disponível no momento" no lugar dos cards; filtros em um catálogo normal que não encontram nada mostram "Nenhum NFT encontrado" | `loading-states`, `catalog` |
| Rede lenta, skeletons | `/?scenario=slow` (2,5 s por chamada) ou `jitter` (150 ms a 2,5 s), depois navegue | Nove cards skeleton em uma região ocupada, trocados pelo conteúdo no mesmo tamanho; detalhes, carrinho e checkout têm seus próprios skeletons | `loading-states` |
| Respostas fora de ordem | `/?scenario=out-of-order`, digite rápido na caixa de busca | A lista mostra o resultado da **última** busca, nunca o da primeira, que é lenta | `catalog` |
| Offline, depois recuperação | `/?scenario=offline` (toda chamada falha, o tempo real está desligado); depois painel → "Padrão" | Alerta de erro com "Tentar novamente"; depois que o cenário muda, a nova tentativa carrega os dados | `loading-states`, `mocks` |
| 5xx com recuperação por retry | `/?scenario=errors-then-recover` (catálogo, detalhes, carrinho e hero respondem 503 três vezes) | A query tenta de novo duas vezes, mostra o alerta, e "Tentar novamente" recupera | `loading-states` |
| 4xx (limite de requisições) | `/?scenario=rate-limited` (a listagem responde 429 três vezes) | O alerta traz a mensagem da própria API; a nova tentativa recupera | `loading-states` |
| Servidor fora do ar | `/?scenario=server-down` (tudo responde 500) | Telas de erro de rota e alertas inline; nada exibe dado desatualizado como se fosse novo | `mocks`, `smoke` |
| Sessão expirada com retomada | `/?scenario=session-short` (60 s), ou `__mock.expireSessions()` enquanto estiver no checkout | Redirecionamento para `/login?redirect=…` com um aviso de "expirada"; entrar de novo volta para a mesma página, e o rascunho do checkout continua lá | `auth`, `checkout-failures` |
| Não autenticado, proibido | Sem login, abra `/profile`; como Bruno, abra `/orders/ord_000001` | Redirecionamento para o login com o caminho de volta; uma tela 403 sem dados do pedido | `auth`, `receipt` |
| Conflito no cadastro, validação | Cadastre-se com `ana@kurio.example`; envie os formulários vazios | Erro de campo vindo da API; foco no primeiro campo inválido | `auth`, `account` |
| Cupom inválido, expirado | No carrinho, aplique `NAOEXISTE` e depois `VERAO25`; `KURIO10` e `COLECAO05` (exige 0.50 ETH) são válidos | "Cupom inválido." / "Este cupom expirou." abaixo do campo, com o código digitado mantido | `cart` |
| Preço muda ou esgota durante o checkout | `/?scenario=price-change-on-checkout` ou `sold-out-on-checkout`, depois pague; ou, com o carrinho da Ana aberto, rode `__mock.updateNft('emerald-ape-042', { price: '9.99' })` (ele está no carrinho dela) | A revisão mostra os novos valores e exige "Aceitar novos valores" (ou bloqueia as linhas esgotadas); o carrinho aberto se atualiza e o total acompanha | `realtime-checkout`, `checkout-failures` |
| Timeout após criar o pedido | `/?scenario=order-timeout`, depois pague | "Tentar novamente reenvia o mesmo pedido: você não paga duas vezes"; a nova tentativa cai no **mesmo** pedido | `checkout-failures` |
| Pagamento recusado | `/?scenario=payment-declined` (recusa 3 s após a criação), depois pague | "Pagamento recusado", carrinho intacto, "Tentar novamente" reabre o formulário | `checkout-failures` |
| Pagamento manual (pendente) | `/?scenario=payment-manual`, pague, depois painel → "Confirmar pedidos pendentes" (ou `__mock.settleOrder(id, 'confirmed')`) | O pedido fica pendente até ser liquidado; depois confirma via `order.updated` | `realtime-checkout` |
| Pedido pendente após reload ou desconexão | `/?scenario=pending-order` (a Ana tem um pedido pendente), recarregue no checkout; ou `__mock.realtime.drop({ block: true })` e depois `restore()` | O checkout mostra o pedido pendente e espera; após reconectar, o status se atualiza (eventos ou o poll de 5 s) | `realtime-resilience` |
| Eventos duplicados ou antigos | `__mock.realtime.redeliver(3)`; `__mock.realtime.inject({ …versão antiga… })` com `/dev/realtime` (servidor de desenvolvimento) para acompanhar os resultados | Sem toast duplicado nem flicker; a guarda os descarta como duplicados ou obsoletos | `realtime-resilience` |
| Carteira recusa ou derruba a conexão | `/?scenario=wallet-reject`, vá ao checkout, abra a revisão, pressione "Conectar"; para uma queda: conecte, depois `__mock.disconnectWallet()` e pressione pagar | "A carteira recusou a conexão." com o pagamento desabilitado; depois de `__mock.configure({ walletConnect: { outcome: 'approve' } })`, "Tentar novamente" conecta. Uma carteira derrubada mostra "Carteira desconectada" e pede para reconectar | `checkout-failures` |
| Explorador de blocos simulado | Abra o comprovante da Ana `/orders/ord_000001` → "Ver no Etherscan" | A página interna `/explorer/ethereum/tx/<hash>` (faixa "Explorador simulado"), na mesma aba; Voltar retorna ao comprovante. Nenhum link externo está envolvido | `explorer` |
| Não encontrado | `/nao-existe`, `/nfts/abc`, um hash desconhecido no explorador | "Página não encontrada" (o HTTP é 200: fallback de SPA) ou a tela 404 dos detalhes; a URL permanece como foi digitada | `smoke`, `nft-details`, `explorer` |
| Favoritar falha | Em qualquer página, rode `__mock.addRule({ op: 'favorites.add', effect: { kind: 'http', status: 500, code: 'INTERNAL' }, times: 1 })` e depois clique em um coração | O coração muda na hora, volta atrás, e um toast oferece "Tentar novamente" | `favorites` |

## Comandos

| Comando | O que faz | Saída |
|---|---|---|
| `pnpm dev` | Servidor de desenvolvimento do Vite com mocks, porta 5173 | — |
| `pnpm build` | `tsc -b` e depois o build de produção | `dist/` |
| `pnpm preview` | Serve `dist/`, porta 4173 | — |
| `pnpm typecheck` | `tsc -b` | — |
| `pnpm lint` | ESLint, zero warnings | — |
| `pnpm format` / `pnpm format:check` | Prettier: escreve / verifica | — |
| `pnpm test` | Testes unitários e de contrato com Vitest (incluindo as verificações dos docs) | — |
| `pnpm test:e2e` | Playwright, Chromium desktop e mobile; faz o build e o preview sozinho | `playwright-report/`, `test-results/` |
| `pnpm test:e2e:report` | Abre o último relatório HTML | — |
| `pnpm test:visual` | Apenas os testes de regressão visual | `e2e/__screenshots__/` (baselines) |
| `pnpm test:visual:update` | Regenera as baselines visuais | `e2e/__screenshots__/` |
| `pnpm lighthouse` | Faz o build e audita home e detalhes, mobile e desktop, 3 execuções cada | `reports/lighthouse/` |
| `pnpm lighthouse:publish` | O mesmo, e copia o resumo e as execuções medianas | `lighthouse/reports/` |
| `pnpm lighthouse:deployed <url>` | Audita uma origem publicada (somente relatório) | `reports/lighthouse/deployed/` |
| `pnpm docs:update` | Regenera as tabelas deste README, do `ARCHITECTURE.pt-BR.md` e das cópias em inglês a partir do código | edita os quatro arquivos |

`pnpm docs:update` define uma variável de ambiente na própria linha, então no Windows rode-o pelo Git Bash ou pelo WSL.

## Testes

- **Primeira execução:** o E2E precisa do navegador do Playwright uma vez: `pnpm exec playwright install chromium`.
- **Unitários e de contrato:** `pnpm test`. Os testes de contrato chamam o cliente Axios real contra o `msw/node`.
- **E2E:** `pnpm test:e2e` roda contra o build otimizado (o servidor web do Playwright executa `pnpm build` e `vite preview` na porta 4173, com `VITE_ENABLE_DEV_ROUTES=true`, e reaproveita um servidor que já esteja rodando). **O paralelismo padrão do Playwright pode sobrecarregar uma máquina pequena; adicione `--workers=3`:** `pnpm test:e2e --workers=3`. Um projeto: `pnpm test:e2e --project=mobile-chromium`; um arquivo: `pnpm test:e2e e2e/cart.spec.ts`. Um servidor que sobrou de um `pnpm build` comum não tem as páginas `/dev/*`, então alguns testes falham com not-found: pare-o e deixe o Playwright iniciar o seu.
- **Relatório e traces:** `pnpm test:e2e:report`; um teste que falha guarda um trace, uma captura de tela e um vídeo. Abra um trace com `pnpm exec playwright show-trace test-results/<test>/trace.zip`.
- **Regressão visual:** `pnpm test:visual` e `pnpm test:visual:update`. As 16 baselines levam a tag `-linux` (fontes e anti-aliasing mudam entre sistemas). No macOS e no Windows os testes `@visual` são **reportados como ignorados**, não como falhos; rode `pnpm test:visual:update` uma vez para criar suas próprias baselines locais e revise as imagens antes de commitá-las.
- **Acessibilidade:** o axe roda dentro da suíte E2E (`e2e/a11y.spec.ts`); nenhuma regra é desabilitada.

**Verificação de checkout limpo.** `scripts/delivery-check.sh` clona o `HEAD` commitado em uma pasta temporária e roda ali instalação, typecheck, lint, format, testes unitários, build (verificando a meta `kurio-build`, a ausência de chunk do harness `/dev` e de senha em texto puro em `dist/`) e a suíte E2E, de modo que nada possa depender de arquivos ignorados ou de estado local. `SKIP_E2E=1` pula o último passo; `E2E_PORT` muda a porta do preview.

O mapa de cada cenário exigido para o seu arquivo de teste está em [`ARCHITECTURE.pt-BR.md`](ARCHITECTURE.pt-BR.md#10-estratégia-de-testes).

## Lighthouse

Auditado na URL **publicada** (Lighthouse CLI via LHCI, 3 execuções por página e perfil, medianas, 2026-10-29):

| Perfil | Página | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | Home | 86 | 100 | 100 | 100 | 3,35 s | 0 | 89 ms |
| Mobile | Detalhes | 86 | 100 | 100 | 100 | 3,33 s | 0 | 54 ms |
| Desktop | Home | 99 | 100 | 100 | 100 | 0,75 s | 0 | 0 ms |
| Desktop | Detalhes | 99 | 100 | 100 | 100 | 0,76 s | 0 | 0 ms |

Build `6915bac`, o deploy final; para repetir, rode `pnpm lighthouse:deployed https://ntfs-marketplace.vercel.app/`. O resumo desta execução, com as verificações ao vivo do id de build, de `/dev` e do `robots.txt`, está em [`lighthouse/reports/deployed-2026-10-29.md`](lighthouse/reports/deployed-2026-10-29.md). A auditoria local contra o `vite preview` (relatórios commitados, com a análise de cada ponto perdido) está em [`lighthouse/reports/summary.md`](lighthouse/reports/summary.md): Performance mobile 76 ali, desktop 98–99.

**A Performance mobile está abaixo da meta de 90 do enunciado (86 publicada, 76 local); todas as outras categorias e metas são atingidas, e o CLS é 0 em todo lugar.** É um desvio aceito e documentado: o slow 4G simulado do Lighthouse, com CPU 4× mais lenta, precifica a cadeia HTML → app → worker do mock → API → imagem do LCP, e um build de diagnóstico com os mocks desligados chegou a apenas 79–83 localmente. A análise e as opções não adotadas estão em [`lighthouse/reports/analysis.md`](lighthouse/reports/analysis.md) e em [`ARCHITECTURE.pt-BR.md`](ARCHITECTURE.pt-BR.md#12-notas-de-desempenho).

## Deploy

Vercel, preset de framework Vite, configurado por [`vercel.json`](vercel.json): `pnpm install --frozen-lockfile`, `pnpm build`, saída `dist/`; um rewrite de SPA para `index.html` em todo caminho exceto `/assets/` (assim um chunk com hash ausente é um 404, não HTML); `mockServiceWorker.js` servido com `Cache-Control: no-cache` (um worker novo a cada release) e `/assets/*` como `immutable`. Configurações do projeto: Node 24.x e `ENABLE_EXPERIMENTAL_COREPACK=1` para que a Vercel use a versão do pnpm do `packageManager`. As páginas de harness `/dev/*` ficam fora do build de deploy (veja `ARCHITECTURE.pt-BR.md`, seção 13).

**Confira que o deploy é o código entregue.** Todo build carrega o seu commit no head da página. Leia-o no DevTools (`<meta name="kurio-build">`) ou:

```sh
curl -s https://ntfs-marketplace.vercel.app/ | grep kurio-build
git rev-parse --short=7 HEAD
```

Os dois valores devem ser iguais (o `VERCEL_GIT_COMMIT_SHA` da Vercel, primeiros 7 caracteres; um build local usa `git rev-parse --short=7 HEAD`, ou `dev` fora de um checkout git). Confira também que `/mockServiceWorker.js` responde 200 com `cache-control: no-cache`, que um deep link (`/cart`) sobrevive a um refresh e que `/?scenario=empty` mostra o catálogo vazio.

## Limitações conhecidas

Tudo é simulado (sem backend, carteira ou chain reais), e os eventos de tempo real chegam apenas à aba que causou a mudança. A Performance mobile do Lighthouse está abaixo da meta (acima). As baselines visuais são só para Linux. URLs desconhecidas retornam HTTP 200 com a tela de not-found (uma SPA na Vercel). A lista completa, com os motivos, está em [`ARCHITECTURE.pt-BR.md`](ARCHITECTURE.pt-BR.md#14-limitações); cada desvio do Figma e do enunciado está na [seção 13](ARCHITECTURE.pt-BR.md#13-desvios-e-decisões). Telas **sem frame no Figma** (compostas pelas specs, documentadas lá): perfil mobile, carteiras mobile, confirmação de pedido mobile, larguras de tablet, o sheet de filtros mobile, a etapa de revisão do checkout e o explorador simulado.
