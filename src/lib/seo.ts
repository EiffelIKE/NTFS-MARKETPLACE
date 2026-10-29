// The public deployment, rather than the current host (which may be a local or preview URL).
export const SITE_URL = 'https://ntfs-marketplace.vercel.app'
export const SITE_TITLE = 'KURIO — Marketplace de NFTs'
export const SITE_DESCRIPTION =
  'KURIO — marketplace de NFTs: descubra, colecione e compre edições digitais.'
export const SHARE_IMAGE = `${SITE_URL}/og-image.jpg`
export const SHARE_IMAGE_ALT = 'Macaco de óculos redondos e jaqueta universitária verde'

interface PageHeadOptions {
  title?: string
  description?: string
  /** Public pathname only; query strings and fragments are not canonical URLs. */
  path?: string
  noindex?: boolean
}

/** Shared fallback and route metadata, managed by TanStack Router's existing HeadContent. */
export function pageHead({
  title,
  description = SITE_DESCRIPTION,
  path,
  noindex = false,
}: PageHeadOptions = {}) {
  const url = new URL(path ?? '/', SITE_URL).href
  return {
    meta: [
      ...(title ? [{ title }] : []),
      { name: 'description', content: description },
      { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'KURIO' },
      { property: 'og:locale', content: 'pt_BR' },
      { property: 'og:title', content: title ?? SITE_TITLE },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: SHARE_IMAGE },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:width', content: '1000' },
      { property: 'og:image:height', content: '1000' },
      { property: 'og:image:alt', content: SHARE_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title ?? SITE_TITLE },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: SHARE_IMAGE },
      { name: 'twitter:image:alt', content: SHARE_IMAGE_ALT },
    ],
    // No site-wide canonical in the SPA fallback: that would canonicalize every deep link to /.
    links: path ? [{ rel: 'canonical', href: url }] : [],
  }
}
