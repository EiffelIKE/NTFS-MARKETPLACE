import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/model/redirects'
import { highlightsQuery, nftListQuery } from '@/features/catalog/api/queries'
import { HomePage } from '@/features/catalog/home/home-page'
import { catalogSearch, toListQuery } from '@/features/catalog/model/search'
import { pageHead, SITE_TITLE } from '@/lib/seo'

const noop = () => undefined

export const Route = createFileRoute('/')({
  validateSearch: catalogSearch,
  // Favorites mode needs a session (CAT-24); a visitor goes to `/login?redirect=<this URL>`.
  loaderDeps: ({ search }) => ({ query: toListQuery(search) }),
  beforeLoad: async ({ search, context, location }) => {
    if (search.favorites !== undefined) await requireAuth({ context, location })
  },
  // Not awaited: the page renders its skeletons at once and the router never waits for the
  // catalog (CAT-14). The components read the same query keys, so nothing is fetched twice.
  loader: ({ context, deps }) => {
    void context.queryClient.query(nftListQuery(deps.query)).catch(noop)
    void context.queryClient.query(highlightsQuery()).catch(noop)
  },
  staticData: { shell: { nav: 'home', headerDivider: true, mobile: { kind: 'tab', tab: 'home' } } },
  head: ({ match }) =>
    pageHead({
      title: match.search.favorites !== undefined ? 'Lista de interesse · KURIO' : SITE_TITLE,
      path: '/',
      noindex: match.search.favorites !== undefined,
    }),
  component: HomePage,
})
