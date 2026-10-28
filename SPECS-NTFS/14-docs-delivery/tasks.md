# 14 — Docs & delivery · Tasks

> Status: Draft — see [Open questions](requirements.md#open-questions).

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts when specs 00–13 are Done. T01 and T02 can start earlier and be refreshed at the end.

## Blockers (user-provided)

- **B1 — Git repository** (initialized by the user's instruction, then pushed to a public remote): T06, T07, T08.
- **B2 — Vercel project and deploy** with the user's account: T07, T08.

## Tasks

- [ ] **T01 — Generated sections** · DOC-04, DOC-09
  - `scripts/docs.ts`, `scripts/docs.test.ts` and the `docs` script (design §1).
  - **Proof:** `pnpm docs` fills both tables; editing a scenario label makes `pnpm test` fail until `pnpm docs` runs again.

- [ ] **T02 — README.md** · DOC-01 – DOC-07
  - Outline in design §2; credentials from `src/mocks/fixtures/credentials.ts`; failure table checked against the scenario registry and spec 03's controls.
  - **Proof:** following the README on a second browser profile, every failure row produces its expected result (checked one by one in a checklist kept under this task); every command in the table exists in `package.json`.

- [ ] **T03 — ARCHITECTURE.md** · DOC-08 – DOC-14
  - Outline in design §3; two Mermaid diagrams; deviation collection from every spec's notes section.
  - **Proof:** every item in the notes sections of `SPECS-NTFS/*/design.md` appears in §13 (checklist kept under this task); Mermaid renders in a Markdown preview; every brief §9 scenario maps to an existing test file.

- [ ] **T04 — Build identifier** · DOC-16
  - `transformIndexHtml` step in `vite.config.ts` (design §4).
  - **Proof:** `pnpm build` → `dist/index.html` has `kurio-build`; with `VERCEL_GIT_COMMIT_SHA=abc123` it is `abc123`.

- [ ] **T05 — Clean-checkout script** · DOC-15
  - `scripts/delivery-check.sh` (design §5), using the `rsync` path until B1.
  - **Proof:** the script passes from a temporary folder with no `node_modules`, no `.env*.local` and an empty browser profile.

- [ ] **T06 — Clean clone** · DOC-15 · *blocked by B1*
  - Switch the script to `git clone --no-local .`.
  - **Proof:** passes from a clone.

- [ ] **T07 — Deploy check** · DOC-07, DOC-16, DOC-17 · *blocked by B1, B2*
  - `scripts/deploy-check.ts` (design §6); add the URL and repository links to the README.
  - **Proof:** all checks pass against the public URL in both projects; build identity equals the pushed commit.

- [ ] **T08 — Final delivery**
  - Re-run T01, `pnpm lighthouse` (spec 13 publish), `scripts/delivery-check.sh` and the deploy check on the final commit.
  - **Proof:** all green; [`../README.md`](../README.md) marks every spec Done.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| DOC-01 | T02 | quick start followed |
| DOC-02 | T02 | env table matches schema |
| DOC-03 | T02 | credentials from fixtures |
| DOC-04 | T01, T02 | generated scenario table |
| DOC-05 | T02 | commands exist |
| DOC-06 | T02 | failure rows reproduced |
| DOC-07 | T02, T07 | links |
| DOC-08 | T03 | layout section |
| DOC-09 | T01, T03 | generated operations table |
| DOC-10 | T03 | realtime section |
| DOC-11 | T03 | session, cart, orders sections |
| DOC-12 | T03 | cache policy and matrix |
| DOC-13 | T03 | deviation checklist |
| DOC-14 | T03 | scenario → test map |
| DOC-15 | T05, T06 | delivery check |
| DOC-16 | T04, T07 | `kurio-build` meta |
| DOC-17 | T07 | deploy check |
