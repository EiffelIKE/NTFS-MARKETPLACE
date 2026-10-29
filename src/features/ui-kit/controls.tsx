import * as React from 'react'

import { ArrowRightIcon, CartIcon, FilterIcon, HeartIcon, SearchIcon } from '@/components/icons'
import { QuantityStepper } from '@/components/quantity-stepper'
import { Unavailable } from '@/components/layout/unavailable'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { RadioGroup, RadioGroupChip, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'

import { Section } from './section'

export function ButtonsSection() {
  const [loading, setLoading] = React.useState(false)
  return (
    <Section id="botoes" title="Botões">
      <Button>Explorar</Button>
      <Button>
        Explorar <ArrowRightIcon data-icon="inline-end" />
      </Button>
      <Button variant="secondary">Secundário</Button>
      <Button variant="outline">
        <HeartIcon data-icon="inline-start" />
        Favoritar
      </Button>
      <Button variant="ghost">Fantasma</Button>
      <Button variant="link">Continuar explorando</Button>
      <Button size="sm">Pequeno</Button>
      <Button size="icon" variant="ghost" aria-label="Buscar">
        <SearchIcon />
      </Button>
      <Button size="icon-lg" aria-label="Filtros">
        <FilterIcon className="size-5.5" />
      </Button>
      <Button disabled>Desabilitado</Button>
      <Button variant="secondary" disabled>
        Desabilitado
      </Button>
      <Button
        loading={loading}
        onClick={() => {
          setLoading(true)
          window.setTimeout(() => {
            setLoading(false)
          }, 1500)
        }}
      >
        <CartIcon data-icon="inline-start" />
        Adicionar ao carrinho
      </Button>
      <Button loading>Comprar</Button>
    </Section>
  )
}

export function FieldsSection() {
  return (
    <Section id="campos" title="Campos" className="grid gap-6 md:grid-cols-2">
      <Field>
        <FieldLabel>Nome de exibição</FieldLabel>
        <Input placeholder="Nova Sato" />
        <FieldDescription>Aparece no seu perfil público.</FieldDescription>
      </Field>
      <Field invalid>
        <FieldLabel>E-mail</FieldLabel>
        <Input type="email" defaultValue="nova@" />
        <FieldError>Digite um e-mail válido.</FieldError>
      </Field>
      <Field>
        <FieldLabel>Código de indicação</FieldLabel>
        <Input disabled placeholder="Indisponível" />
      </Field>
      <Field>
        <FieldLabel>Senha</FieldLabel>
        <PasswordInput placeholder="Sua senha" autoComplete="current-password" />
      </Field>
      <Field>
        <FieldLabel>Código promocional</FieldLabel>
        <InputGroup>
          <InputGroupInput placeholder="Digite o código promocional..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="primary" size="sm">
              Aplicar
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>Buscar</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Explorar coleções" />
        </InputGroup>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel>Observação do colecionador (opcional)</FieldLabel>
        <Textarea placeholder="Escreva uma observação" />
      </Field>
    </Section>
  )
}

export function ChoiceSection() {
  return (
    <Section id="selecao" title="Seleção" className="grid gap-8 md:grid-cols-2">
      <FieldSet>
        <FieldLegend>Coleções</FieldLegend>
        <FieldGroup className="gap-3">
          {['Arte digital', 'Fotografia', 'Música'].map((label, index) => (
            <Field key={label} orientation="horizontal">
              <Checkbox defaultChecked={index === 0} />
              <FieldLabel className="font-normal">{label}</FieldLabel>
            </Field>
          ))}
          <Field orientation="horizontal">
            <Checkbox disabled />
            <FieldLabel className="font-normal">Desabilitado</FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Edição</FieldLegend>
        <RadioGroup defaultValue="1/50" aria-label="Edição" className="flex flex-wrap gap-2">
          {['1/1', '1/10', '1/50', 'ABERTA'].map((value) => (
            <RadioGroupChip key={value} value={value}>
              {value}
            </RadioGroupChip>
          ))}
          <RadioGroupChip value="esgotada" disabled>
            1/5
          </RadioGroupChip>
        </RadioGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Edição (detalhes do NFT)</FieldLegend>
        <RadioGroup
          defaultValue="1/10"
          aria-label="Edição (variante outline)"
          className="flex flex-wrap gap-1.5"
        >
          {['1/1', '1/10', '1/50', 'ABERTA'].map((value) => (
            <RadioGroupChip key={value} variant="outline" value={value}>
              {value}
            </RadioGroupChip>
          ))}
          <RadioGroupChip variant="outline" value="esgotada" disabled>
            1/5
          </RadioGroupChip>
        </RadioGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Quantidade</FieldLegend>
        <StepperDemo />
      </FieldSet>

      <FieldSet>
        <FieldLegend>Carteira</FieldLegend>
        <RadioGroup defaultValue="metamask" aria-label="Carteira">
          {['MetaMask', 'Coinbase Wallet', 'WalletConnect'].map((label) => (
            <div key={label} className="flex items-center gap-3">
              <RadioGroupItem value={label.toLowerCase()} id={`wallet-${label}`} />
              <Label htmlFor={`wallet-${label}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </FieldSet>

      <div className="flex flex-col gap-6">
        <Field orientation="horizontal">
          <FieldLabel className="font-normal text-text-secondary">Ordenar por:</FieldLabel>
          <Select defaultValue="recentes">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Listados recentemente</SelectItem>
              <SelectItem value="menor-preco">Menor preço</SelectItem>
              <SelectItem value="maior-preco">Maior preço</SelectItem>
              <SelectItem value="indisponivel" disabled>
                Mais vendidos
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-col gap-3">
          <p className="text-body-md text-foreground">Preço: 0,02 - 12,30 ETH</p>
          <Slider defaultValue={[2, 80]} thumbLabels={['Preço mínimo', 'Preço máximo']} />
        </div>
      </div>
    </Section>
  )
}

export function UnavailableSection() {
  return (
    <Section id="indisponivel" title="Fora do escopo">
      <Unavailable className="text-body-lg text-foreground">Criadores</Unavailable>
      <Unavailable className="text-body text-foreground">Central de ajuda</Unavailable>
    </Section>
  )
}

function StepperDemo() {
  const [value, setValue] = React.useState(2)
  return (
    <div className="flex flex-wrap items-center gap-8">
      <QuantityStepper value={value} min={1} max={5} onChange={setValue} label="Quantidade (md)" />
      <QuantityStepper
        size="sm"
        value={value}
        min={1}
        max={5}
        onChange={setValue}
        label="Quantidade (sm)"
      />
    </div>
  )
}
