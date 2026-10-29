import { Unavailable } from '@/components/layout/unavailable'
import { NftImage } from '@/components/nft-image'

import { BLOG } from '../content/home-copy'
import { staticImage } from '../content/static-images'

/**
 * "Diário da Cunhagem" (CAT-22): static copy, desktop only. Articles are out of scope, so every
 * "Ler mais" is an unavailable link that says so and never navigates.
 */
export function BlogSection() {
  return (
    <section aria-labelledby="blog-title" className="hidden flex-col items-center gap-10 lg:flex">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2
          id="blog-title"
          className="text-heading text-foreground lg:text-[1.75rem] lg:leading-9.5"
        >
          {BLOG.title}
        </h2>
        <p className="text-body text-text-secondary">{BLOG.subtitle}</p>
      </div>
      <ul className="grid w-full grid-cols-4 gap-6">
        {BLOG.posts.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-md bg-surface-card">
              <NftImage
                image={staticImage(post.artwork)}
                slot="blog"
                className="aspect-[268/195] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <p className="text-caption-sm font-medium text-text-secondary">{post.meta}</p>
                <h3 className="text-body-lg font-bold text-text-primary">{post.title}</h3>
                <p className="text-caption-sm font-medium text-text-secondary">{post.excerpt}</p>
                <Unavailable className="mt-auto w-fit pt-1 text-caption-sm font-bold text-text-accent">
                  Ler mais →
                </Unavailable>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
