import type { HighlightsRecord } from '../db/state'

// Slide 1 is the Figma copy. Slides 2 and 3 are not drawn (Figma only shows the carousel dots),
// so they reuse the two promo-card headlines (spec 02 §9; spec 05 records the deviation).
export const HIGHLIGHTS: HighlightsRecord = {
  hero: [
    {
      id: 'hero-1',
      nftId: 'emerald-ape-042',
      eyebrow: 'Bem-vindo à Kurio',
      title: 'SEJA DONO DO FUTURO DA ARTE DIGITAL',
      shortTitle: 'SEJA DONO DA CULTURA DIGITAL',
      description:
        'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
      shortDescription: 'Descubra NFTs selecionados de criadores do mundo todo.',
      artwork: 'ape-varsity',
    },
    {
      id: 'hero-2',
      nftId: 'neon-vessel-552',
      eyebrow: 'Novidades da semana',
      title: 'LANÇAMENTOS GÊNESIS DE EDIÇÃO LIMITADA',
      shortTitle: 'LANÇAMENTOS GÊNESIS',
      description:
        'Garanta as primeiras peças de cada coleção antes que se esgotem. Edições limitadas, certificadas na rede e prontas para colecionar.',
      shortDescription: 'Garanta as primeiras peças de cada coleção.',
      artwork: 'gorilla-turtleneck',
    },
    {
      id: 'hero-3',
      nftId: 'golden-beat-207',
      eyebrow: 'Curadoria Kurio',
      title: 'ARTE DIGITAL SELECIONADA E MUITO MAIS',
      shortTitle: 'ARTE DIGITAL SELECIONADA',
      description:
        'Uma curadoria de música, arte 3D, fotografia e colecionáveis para todos os gostos, assinada por criadores de todo o mundo.',
      shortDescription: 'Música, arte 3D e colecionáveis de criadores do mundo todo.',
      artwork: 'ape-headphones',
    },
  ],
  featured: {
    nftId: 'cosmic-bloom-118',
    title: 'NFT EM DESTAQUE',
    subtitle: 'OFERTA LIMITADA',
    artwork: 'gorilla-bucket-hat',
  },
}
