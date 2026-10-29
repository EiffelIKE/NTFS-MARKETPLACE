import * as React from 'react'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NftSegment } from '@/contracts'
import { cn } from '@/lib/utils'

import { SEGMENT_LABELS } from '../model/labels'

/**
 * "Todos os NFTs / Novos lançamentos / Em alta" (CAT-26). It is the tab strip of a `Tabs` root owned
 * by the catalog section; below `lg` it scrolls sideways and keeps the active tab in view.
 */
export function SegmentTabs({ active, className }: { active: NftSegment; className?: string }) {
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const list = listRef.current
    const tab = list?.querySelector<HTMLElement>('[role=tab][data-active]')
    if (!list || !tab) return
    const left = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2
    list.scrollTo({ left: Math.max(0, left) })
  }, [active])

  return (
    <TabsList
      ref={listRef}
      aria-label="Segmentos do catálogo"
      className={cn('snap-x snap-proximity lg:w-auto', className)}
    >
      {NftSegment.options.map((segment) => (
        <TabsTrigger key={segment} value={segment} className="snap-start">
          {SEGMENT_LABELS[segment]}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
