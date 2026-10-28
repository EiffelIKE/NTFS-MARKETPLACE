import * as React from 'react'

import { announce, notify } from '@/components/feedback'
import {
  AlertCircleIcon,
  CartIcon,
  CheckCircleIcon,
  DangerTriangleIcon,
  MoreVerticalIcon,
} from '@/components/icons'
import { LoadingRegion } from '@/components/loading-region'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { Section } from './section'

export function NavigationSection() {
  const [page, setPage] = React.useState(2)
  const pages = [1, 2, 3]
  return (
    <Section id="navegacao" title="Navegação" className="flex-col items-start gap-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#navegacao">Mercado</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Aurora Drift #12</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Tabs defaultValue="descricao" className="w-full max-w-xl">
        <TabsList>
          <TabsTrigger value="descricao">Descrição</TabsTrigger>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="descricao">Uma peça generativa sobre luz e movimento.</TabsContent>
        <TabsContent value="detalhes">Contrato ERC-721 · Ethereum</TabsContent>
        <TabsContent value="historico">Mintado em 12/03/2026.</TabsContent>
      </Tabs>

      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#navegacao"
              onClick={(event) => {
                event.preventDefault()
                setPage((current) => Math.max(1, current - 1))
              }}
            />
          </PaginationItem>
          {pages.map((value) => (
            <PaginationItem key={value}>
              <PaginationLink
                href="#navegacao"
                isActive={value === page}
                onClick={(event) => {
                  event.preventDefault()
                  setPage(value)
                }}
              >
                {value}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#navegacao"
              onClick={(event) => {
                event.preventDefault()
                setPage((current) => Math.min(pages.length, current + 1))
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </Section>
  )
}

export function DisplaySection() {
  return (
    <Section id="exibicao" title="Exibição" className="flex-col items-start gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Badge>Raro</Badge>
        <Badge>Lendário</Badge>
        <span className="relative inline-flex">
          <CartIcon className="size-6 text-foreground" />
          <Badge variant="count" className="absolute -top-1 -right-2">
            3
          </Badge>
          <span className="sr-only">Carrinho, 3 itens</span>
        </span>
        <Avatar size="sm">
          <AvatarFallback>NS</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>NS</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>NS</AvatarFallback>
        </Avatar>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Passe o mouse</Button>
          </TooltipTrigger>
          <TooltipContent>Dica com atraso de 200 ms</TooltipContent>
        </Tooltip>
      </div>
      <Separator />
      <Alert className="max-w-xl">
        <DangerTriangleIcon />
        <AlertTitle>Não foi possível carregar os NFTs</AlertTitle>
        <AlertDescription>Verifique sua conexão e tente novamente.</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="secondary">
            Tentar novamente
          </Button>
        </AlertAction>
      </Alert>
      <Alert variant="info" className="max-w-xl">
        <AlertCircleIcon />
        <AlertTitle>Pagamento em análise</AlertTitle>
        <AlertDescription>Você receberá uma notificação quando for confirmado.</AlertDescription>
      </Alert>
    </Section>
  )
}

export function LoadingSection() {
  const [loading, setLoading] = React.useState(true)
  return (
    <Section id="carregamento" title="Carregamento" className="flex-col items-start">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setLoading((current) => !current)
        }}
      >
        {loading ? 'Mostrar conteúdo' : 'Mostrar esqueleto'}
      </Button>
      <LoadingRegion loading={loading} label="Carregando NFTs" className="w-full max-w-sm">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-square w-full rounded-artwork" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-artwork bg-surface-card p-4">
            <p className="text-title text-foreground">Aurora Drift #12</p>
            <p className="text-body text-text-secondary">0,42 ETH</p>
          </div>
        )}
      </LoadingRegion>
    </Section>
  )
}

export function OverlaysSection() {
  return (
    <Section id="sobreposicoes" title="Sobreposições e avisos">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">Abrir diálogo</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover do carrinho?</DialogTitle>
            <DialogDescription>Aurora Drift #12 sairá do seu carrinho.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>Remover</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Abrir painel</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Inferior no celular, lateral a partir de 1024 px.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button>Aplicar filtros</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Compartilhar</DropdownMenuItem>
          <DropdownMenuItem>Copiar link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="secondary" onClick={() => notify.success('NFT adicionado ao carrinho')}>
        <CheckCircleIcon data-icon="inline-start" />
        Toast de sucesso
      </Button>
      <Button
        variant="secondary"
        onClick={() => notify.error('Não foi possível concluir o pagamento')}
      >
        Toast de erro
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          announce('3 resultados encontrados')
        }}
      >
        Anunciar
      </Button>
    </Section>
  )
}
