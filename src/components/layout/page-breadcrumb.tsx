import { Link } from '@tanstack/react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

/** "Início / Mercado / <screen>" (Figma, bold 14 in the foreground color): cart and checkout. */
export function PageBreadcrumb({ current }: { current: string }) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="text-body-md font-bold">
        <BreadcrumbItem>
          <BreadcrumbLink asChild className="text-foreground">
            <Link to="/">Início</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild className="text-foreground">
            <Link to="/" hash="mercado">
              Mercado
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
