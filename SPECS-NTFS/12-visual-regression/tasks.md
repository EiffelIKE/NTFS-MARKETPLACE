# 12 — Visual regression · Tasks

> Status: Draft — see [Open questions](requirements.md#open-questions).

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 05–09 are Done and their screens have been compared with the Figma screenshots. Needs Podman or Docker on the machine.

## Tasks

- [ ] **T01 — Config and helpers** · VR-04 – VR-08, VR-10, VR-11
  - `playwright.config.ts` changes (design §2), `e2e/support/visual.ts`, `e2e/support/visual.css`.
  - **Proof:** `pnpm typecheck` clean; `pnpm test:e2e` still passes and lists no `@visual` test.

- [ ] **T02 — Container script** · VR-09, VR-12
  - `scripts/visual.sh` and the two scripts in `package.json` (design §6).
  - **Proof:** `pnpm test:visual` with an empty spec starts the container, installs, builds and exits 0; the image tag printed matches `pnpm ls @playwright/test`.

- [ ] **T03 — Baselines** · VR-01 – VR-03
  - `e2e/visual.spec.ts` with every row of design §4; guard test (design §7).
  - Generate with `pnpm test:visual:update`; review each image against the matching file in `figma_tokens/screenshots/`.
  - **Proof:** files exist under `e2e/__screenshots__/{desktop,mobile}-chromium/`; three consecutive `pnpm test:visual` runs pass with no diff.

- [ ] **T04 — Sensitivity check** · VR-11
  - Temporarily change a token (e.g. `--color-primary`) and a spacing value; run `pnpm test:visual`.
  - **Proof:** both changes fail with diffs in the HTML report (expected, actual, diff); revert, suite passes.

- [ ] **T05 — Wrap-up**
  - Add design §8 notes to the spec 14 list. Update the spec 12 status in [`../README.md`](../README.md).
  - **Proof:** `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`, `pnpm test:visual` clean.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| VR-01 | T03 | four screens × two projects |
| VR-02 | T03 | full page + mobile viewport shots |
| VR-03 | T03 | skeleton shots |
| VR-04 | T01 | `prepare()` resets |
| VR-05 | T01 | frozen clock |
| VR-06 | T01 | `settle()` |
| VR-07 | T01 | config + `visual.css` |
| VR-08 | T03 | mask table (empty or justified) |
| VR-09 | T02 | container run |
| VR-10 | T01, T03 | path template; committed files |
| VR-11 | T01, T04 | tolerance; sensitivity check |
| VR-12 | T01, T02 | scripts; host run skips `@visual` |
