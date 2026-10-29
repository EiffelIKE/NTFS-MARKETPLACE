import { PageContainer } from '@/components/layout/page-container'

import { CatalogSection } from '../components/catalog-section'
import { FiltersSheet } from '../components/filters-sheet'
import { SearchField } from '../components/search-field'
import { BlogSection } from './blog-section'
import { HeroCarousel } from './hero-carousel'
import { PromoCards } from './promo-cards'

/**
 * Home (spec 05 design §5). Both compositions share the DOM and switch at `lg` with CSS: the
 * mobile search row and compact hero, or the desktop hero, sidebar, promos and blog.
 */
export function HomePage() {
  return (
    <PageContainer className="flex flex-col gap-4 lg:gap-24">
      <div className="flex gap-2 lg:hidden">
        <SearchField />
        <FiltersSheet />
      </div>
      <HeroCarousel />
      <CatalogSection />
      <PromoCards />
      <BlogSection />
    </PageContainer>
  )
}
