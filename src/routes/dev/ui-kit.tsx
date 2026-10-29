import { createFileRoute } from '@tanstack/react-router'

import {
  ChoiceSection,
  ButtonsSection,
  FieldsSection,
  UnavailableSection,
} from '@/features/ui-kit/controls'
import {
  DisplaySection,
  LoadingSection,
  NavigationSection,
  OverlaysSection,
} from '@/features/ui-kit/display'
import { CatalogCardsSection } from '@/features/ui-kit/catalog'
import { FormLayerSection } from '@/features/ui-kit/forms'
import { ColorsSection, IconsSection, TypeSection } from '@/features/ui-kit/foundations'
import { PageContainer } from '@/components/layout/page-container'

// Component gallery (DS-32): in every build so E2E can run against `vite preview`, never linked.
export const Route = createFileRoute('/dev/ui-kit')({
  staticData: {
    shell: { nav: 'home', headerDivider: true, mobile: { kind: 'inner', title: 'UI kit' } },
  },
  head: () => ({
    meta: [{ title: 'UI kit · KURIO' }, { name: 'robots', content: 'noindex' }],
  }),
  component: UiKitPage,
})

function UiKitPage() {
  return (
    <PageContainer className="flex flex-col gap-10 pb-16">
      <h1 className="text-display text-foreground">UI kit</h1>
      <ColorsSection />
      <TypeSection />
      <IconsSection />
      <ButtonsSection />
      <FieldsSection />
      <FormLayerSection />
      <ChoiceSection />
      <NavigationSection />
      <DisplaySection />
      <LoadingSection />
      <CatalogCardsSection />
      <OverlaysSection />
      <UnavailableSection />
    </PageContainer>
  )
}
