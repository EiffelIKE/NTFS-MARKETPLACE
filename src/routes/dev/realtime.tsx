import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'
import { ConnectionSection } from '@/features/dev-realtime/connection'
import { EventLogSection } from '@/features/dev-realtime/event-log'
import { NftSection, OrderSection } from '@/features/dev-realtime/resources'

// Harness for the realtime transport (spec 03 §8): in every build so E2E can run against
// `vite preview`, never linked. It reads the real session (spec 04).
export const Route = createFileRoute('/dev/realtime')({
  staticData: {
    shell: { nav: 'home', headerDivider: true, mobile: { kind: 'inner', title: 'Tempo real' } },
  },
  head: () => ({
    meta: [{ title: 'Tempo real · KURIO' }, { name: 'robots', content: 'noindex' }],
  }),
  component: RealtimePage,
})

function RealtimePage() {
  return (
    <PageContainer className="flex flex-col gap-10 pb-16">
      <h1 className="text-display text-foreground">Tempo real</h1>
      <ConnectionSection />
      <NftSection />
      <OrderSection />
      <EventLogSection />
    </PageContainer>
  )
}
