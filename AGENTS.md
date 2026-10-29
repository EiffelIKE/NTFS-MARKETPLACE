## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project and must be followed for every Figma-driven change.

**Extracted design tokens**: [`figma_tokens/`](figma_tokens/README.md) holds colors, spacing, typography, radii, and layout notes extracted from the challenge Figma file (editable copy `di66cL89caut7ECDhUns79`): shared foundations in `tokens.json`, per-screen layout notes in `desktop/` and `mobile/`, and the manual asset export list in `assets.md`. Check there first for token values before re-querying Figma — re-extract only if the source file has changed.

The Figma MCP server provides an assets endpoint which can serve image and SVG assets

- IMPORTANT: If the Figma MCP server returns a localhost source for an image or an SVG, use that image or SVG source directly
- IMPORTANT: DO NOT import/add new icon packages, all the assets should be in the Figma payload
- IMPORTANT: do NOT use or create placeholders if a localhost source is provided

### Required flow (do not skip)

1. Run get_design_context first to fetch the structured representation for the exact node(s).
2. If the response is too large or truncated, run get_metadata to get the high‑level node map and then re‑fetch only the required node(s) with get_design_context.
3. Run get_screenshot for a visual reference of the node variant being implemented.
4. Only after you have both get_design_context and get_screenshot, download any assets needed and start implementation.
5. Translate the output (usually React + Tailwind) into this project's conventions, styles and framework. Reuse the project's color tokens, components, and typography wherever possible.
6. Validate against Figma for 1:1 look and behavior before marking complete.

### Implementation rules

- Treat the Figma MCP output (React + Tailwind) as a representation of design and behavior, not as final code style.
- Replace Tailwind utility classes with the project's preferred utilities/design‑system tokens when applicable.
- Reuse existing components (e.g., buttons, inputs, typography, icon wrappers) instead of duplicating functionality.
- Use the project's color system, typography scale, and spacing tokens consistently.
- Respect existing routing, state management, and data‑fetch patterns already adopted in the repo.
- Strive for 1:1 visual parity with the Figma design. When conflicts arise, prefer design‑system tokens and adjust spacing or sizes minimally to match visuals.
- Validate the final UI against the Figma screenshot for both look and behavior.

## TanStack Router skills

`@tanstack/router-core` and `@tanstack/router-plugin` ship Agent Skills inside their npm packages ([TanStack Intent](https://tanstack.com/intent/registry/%2540tanstack%252Frouter-core)), so they always match the installed version. They are not loaded automatically: before writing routing code, read the `SKILL.md` that covers the task (run `pnpm install` first if `node_modules` is missing).

| Task | Skill |
|---|---|
| Entry point: route trees, `createRootRouteWithContext`, `Register`, file naming | `node_modules/@tanstack/router-core/skills/router-core/SKILL.md` |
| `beforeLoad` guards, `redirect()`, `_authenticated` layout (spec 04) | `node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md` |
| `validateSearch`, URL state for filters/sort/pagination (spec 05) | `node_modules/@tanstack/router-core/skills/router-core/search-params/SKILL.md` |
| Loaders with the Query client in context, pending states, `router.invalidate` | `node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md` |
| `notFound()`, `notFoundComponent`, `errorComponent` (spec 06 NFT 404) | `node_modules/@tanstack/router-core/skills/router-core/not-found-and-errors/SKILL.md` |
| `Link`, `useNavigate`, preloading, navigation blocking | `node_modules/@tanstack/router-core/skills/router-core/navigation/SKILL.md` |
| Dynamic segments (`$nftId`, `$orderId`), `params.parse` | `node_modules/@tanstack/router-core/skills/router-core/path-params/SKILL.md` |
| Type inference, `from` narrowing, `getRouteApi` | `node_modules/@tanstack/router-core/skills/router-core/type-safety/SKILL.md` |
| `autoCodeSplitting`, lazy routes, split groupings | `node_modules/@tanstack/router-core/skills/router-core/code-splitting/SKILL.md`, `node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md` |

Skip `ssr/` (this app is a client-only SPA). Project decisions in `SPECS-NTFS/` win over skill examples when they differ, e.g. Zod 4 schemas go straight into `validateSearch` with `.catch()`, without `@tanstack/zod-adapter` (spec 00 design §1).
