# Langium AI Website

The documentation site for [Langium AI](https://github.com/eclipse-langium/langium-ai),
built with [VitePress](https://vitepress.dev). It consolidates the `langium-ai-tools`
library docs, the `lai` CLI docs, and the agent skills into one linkable reference.

## Getting started

```bash
npm install
npm run docs:dev     # local dev server with hot reload
```

## Scripts

| Script | What it does |
|---|---|
| `npm run docs:dev` | Start the VitePress dev server. |
| `npm run docs:build` | Build the static site. Also runs the twoslash gate (see below). |
| `npm run docs:preview` | Preview the built site locally. |
| `npm run check` | Alias of `docs:build` — Lane 1 of the ci check (twoslash typecheck). |
| `npm run ci:cli` | Lane 2 of the ci check — the `lai` CLI smoke test (see below). |
| `npm run ci` | Both lanes: `docs:build` then `ci:cli`. |

## The correctness gate

The gate has **two independent lanes**:

- **Lane 1 — Twoslash (compile-only).** ` ```ts twoslash ` blocks are typechecked against the
  pinned packages during `docs:build`. Never executes.
- **Lane 2 — CLI smoke (`gate:cli`).** Actually runs `lai` end-to-end from a clean temp dir
  against the `langium-minilogo` fixture (cloned at a pinned commit), proving the CLI
  plumbing — `init` → `gen` → `evaluate` — works. Zero tokens, no model: the scaffolded eval
  cases short-circuit to a stub score before any provider call. See
  [`scripts/lane2-smoke.mjs`](./scripts/lane2-smoke.mjs).

Run both with `npm run gate`.

### Lane 1 — Twoslash

Code blocks marked ` ```ts twoslash ` are build against the pinned npm
packages during `docs:build`, via
[`@shikijs/vitepress-twoslash`](https://shiki.style/packages/vitepress-twoslash). A type
error — a wrong signature, a renamed export, a bad import — fails the build.

- ` ```ts twoslash ` → gated. Must typecheck against the pinned packages.
- ` ```ts ` (no `twoslash`) → shown but **not** gated. This is the rot vector; use sparingly.
- `// @errors: NNNN` inside a gated block → asserts the block is *supposed* to fail with
  that TypeScript error code (used to teach validation/type errors).

Because gated blocks import from the real published entrypoints, the gate doubles as a
public-API-surface test: if you can't import something to document it, that's a bug to fix
upstream, not a doc to hand-wave.

Twoslash reads [`tsconfig.json`](./tsconfig.json) for its compiler options. That config
mirrors `langium-ai`'s `tsconfig.base.json` (NodeNext, strict) so the gated surface matches
how the library is actually consumed. `files: []` there keeps the config valid for a bare
`tsc`; the config exists to drive the per-block typecheck, not to compile a project.

## Pinned dependencies

The docs consume the **published** packages, validating them from a downstream consumer's
perspective. These are pinned to exact versions (and lockfile-pinned) and bumped
deliberately — a `^` range without a committed lockfile is not a pin.

| Package | Version | Role |
|---|---|---|
| `langium-ai-tools` | `6.0.0` | The core library the tools docs are written against. |
| `langium-ai` | `0.5.0` | The `lai` CLI. |
| `langium-minilogo` | `4.2.1` | Gate fixture DSL — makes DSL-touching examples importable/gatable. |

All three are consumed from **public npm** at exact versions (lockfile-pinned). The Lane 2
smoke runner keeps its own copy of the `langium-ai` / `langium-ai-tools` pins in a single
`PINS` block at the top of [`scripts/lane2-smoke.mjs`](./scripts/lane2-smoke.mjs), to keep the
two in sync when bumping.

Provider SDKs (`@anthropic-ai/sdk`, `openai`, `ollama`) are pinned **dev-only** deps so the
gated provider blocks typecheck against the real SDK surface. They are never bundled and
never run.

Bumping any pinned dep means re-running `npm run ci` and fixing whatever the ci flags.

## Layout

```
docs/
  .vitepress/
    config.mts        # site config + twoslash markdown transformer
    theme/index.ts    # default theme + twoslash hover UI
  langium-ai-tools/   # library docs (gated)
  langium-ai/         # lai CLI docs
  skills/             # agent skills docs
tsconfig.json         # twoslash compiler options
```
