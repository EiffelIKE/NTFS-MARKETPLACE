import { useRouter } from '@tanstack/react-router'
import type * as React from 'react'

/**
 * An internal link given as one `href` string (path, search and hash), for targets that are data
 * rather than a typed route: the auth `redirect` and routes whose search another spec defines.
 * Modified clicks keep the browser's behavior; a plain click is handled by the router.
 */
export function HrefLink({
  href,
  onClick,
  ...props
}: Omit<React.ComponentProps<'a'>, 'href'> & { href: string }) {
  const router = useRouter()
  return (
    // The content arrives through `props.children`, which the rule cannot see.
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        void router.navigate({ href })
      }}
      {...props}
    />
  )
}
