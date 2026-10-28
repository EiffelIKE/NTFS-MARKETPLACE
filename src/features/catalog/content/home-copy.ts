import { staticImage, type StaticArtwork } from './static-images'

// Static copy of the home bands (spec 05 design §9). pt-BR, as drawn in Figma.

/** The hero when the API has no highlights (CAT-19): Figma's first slide, with no artwork. */
export const HERO_FALLBACK = {
  eyebrow: 'Bem-vindo à Kurio',
  title: 'SEJA DONO DO FUTURO DA ARTE DIGITAL',
  shortTitle: 'SEJA DONO DA CULTURA DIGITAL',
  description:
    'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
  shortDescription: 'Descubra NFTs selecionados de criadores do mundo todo.',
} as const

export const PROMOS = [
  {
    id: 'genesis',
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: staticImage('ape-varsity'),
    search: { segment: 'new' },
  },
  {
    id: 'curated',
    title: 'Arte digital selecionada e muito mais',
    // Truncated in Figma ("…que definem a"); completed here.
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: staticImage('gorilla-turtleneck'),
    search: { categories: 'arte-digital' },
  },
] as const

export const BLOG = {
  title: 'Diário da Cunhagem',
  subtitle:
    'Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.',
  posts: [
    {
      meta: '12 de setembro  |  Leitura de 6 min',
      title: 'Como funciona a propriedade de NFTs',
      excerpt: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
      artwork: 'gorilla-turtleneck',
    },
    {
      meta: '13 de setembro  |  Leitura de 2 min',
      title: '10 artistas digitais para acompanhar',
      excerpt: 'Conheça criadores que moldam a cultura digital.',
      artwork: 'ape-varsity',
    },
    {
      meta: '15 de setembro  |  Leitura de 3 min',
      title: 'Raridade, atributos e procedência',
      excerpt: 'Entenda raridade, procedência, direitos autorais e utilidade.',
      artwork: 'gorilla-bucket-hat',
    },
    {
      meta: '15 de setembro  |  Leitura de 2 min',
      title: 'Como proteger sua carteira',
      excerpt: 'Proteja sua carteira, seus ativos e sua identidade.',
      artwork: 'ape-headphones',
    },
  ] satisfies {
    meta: string
    title: string
    excerpt: string
    artwork: StaticArtwork
  }[],
} as const
