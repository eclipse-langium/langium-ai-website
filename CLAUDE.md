# CLAUDE.md

Guidance for working in this repository.

## What this is

The documentation site for [Langium AI](https://github.com/eclipse-langium/langium-ai),
built with **VitePress**. It consolidates docs for the `langium-ai-tools` library, the
`lai` CLI (`langium-ai`), and the agent skills into one linkable reference, deployed at
ai.langium.org.

This repo is docs-only. It consumes the **published** npm packages it documents — it does
not build them. Docs are written from the downstream consumer's perspective and are gated
so they can't silently drift from the shipped API.

## Commands

| Command | What it does |
|---|---|
| `npm run docs:dev` | VitePress dev server with hot reload. |
| `npm run docs:build` | Build the static site. Also runs Lane 1 (twoslash typecheck). |
| `npm run docs:preview` | Preview the built site. |
| `npm run check` | Alias of `docs:build` (Lane 1 gate). |
| `npm run ci:cli` | Lane 2 — the `lai` CLI smoke test. |
| `npm run ci` | Both lanes: `docs:build` then `ci:cli`. Run this before pushing. |

Node version is pinned in `.nvmrc` (24.17). Use `npm ci` for clean installs (matches CI).

## The correctness gate (two lanes)

The gate is the verification strategy — there is no separate API-surface review. Write
examples and let the gate fail loudly on wrong signatures or imports.

**Lane 1 — Twoslash (compile-only, never executes).** ` ```ts twoslash ` blocks are
typechecked against the pinned npm packages during `docs:build`, via
`@shikijs/vitepress-twoslash`. Configured in `docs/.vitepress/config.mts`; compiler
options live in `tsconfig.json` (NodeNext, strict — mirrors `langium-ai`'s
`tsconfig.base.json`).

- ` ```ts twoslash ` → **gated**, must typecheck.
- ` ```ts ` (no `twoslash`) → shown but **not** gated. This is the rot vector; use sparingly.
- `// @errors: NNNN` inside a gated block → asserts the block is *supposed* to fail with
  that TS error code (used to teach validation/type errors).
- Only document what's importable from a published entrypoint. If you can't import it to
  document it, that's an upstream bug to fix, not a doc to hand-wave.

**Lane 2 — CLI smoke (`scripts/lane2-smoke.mjs`).** Actually runs `lai` end-to-end from a
clean temp dir against the `langium-minilogo` fixture (cloned at a pinned commit):
`init` → `gen descriptor`/`gen sysprompt` → `evaluate`. Proves the CLI plumbing works.

- **Zero tokens, no model.** The scaffolded `basic.eval.ts` returns a fixed STUB score
  before any provider call. A green Lane 2 proves discovery/config/report plumbing — it
  does NOT prove real model results. Label any eval-output examples in the docs as
  illustrative, not reproduced-by-test.

## Pinned dependencies

Everything is pinned to exact versions and lockfile-pinned; a `^` range without a
committed lockfile is not a pin. Bumping any pin means re-running `npm run ci` and fixing
whatever it flags.

- `langium-ai-tools`, `langium-ai` (the `lai` CLI), `langium-minilogo` (gate fixture DSL)
  — see `package.json` for the current versions.
- Provider SDKs (`@anthropic-ai/sdk`, `openai`, `ollama`) are **dev-only** pins so gated
  provider blocks typecheck against the real SDK surface. Never bundled, never run.

Lane 2 keeps its own copy of the `langium-ai` / `langium-ai-tools` pins in the `PINS`
block at the top of `scripts/lane2-smoke.mjs` (plus the minilogo git SHA). Keep it in sync
with `package.json` when bumping.

> Note: the version tables in `README.md` and `SITE-PLANNING.md` can lag. `package.json`
> and the `PINS` block are the sources of truth.

## Layout

```
docs/
  .vitepress/
    config.mts          # site config + twoslash markdown transformer + sidebar/nav
    twoslash-errors.ts  # rewrites twoslash errors into file:line:column reports
    theme/index.ts      # default theme + twoslash hover UI
  langium-ai-tools/     # library docs (gated)
  langium-ai/           # lai CLI docs
  skills/               # agent skills docs
  public/               # static assets
scripts/lane2-smoke.mjs # Lane 2 CLI smoke test
tsconfig.json           # twoslash compiler options (not a build config)
SITE-PLANNING.md        # design rationale for the site + gate
.github/workflows/
  ci.yml                # both gate lanes, on PRs and pushes to main
  deploy.yml            # builds and publishes to GitHub Pages
```

## Deployment

Pushes to `main` deploy to ai.langium.org via `deploy.yml`. Pages is in "workflow" build
mode, so there is no `gh-pages` branch and no `CNAME` file in the repo, the custom domain
lives in the repo's Pages settings.

Repo settings are **not** managed here. They come from an Eclipse Otterdog config
(`eclipse-langium/.eclipsefdn`, the `langium-ai-website` entry), which owns
`gh_pages_build_type`, branch protection, and the `github-pages` environment that
restricts deploys to `main`. Change those there, not in the GitHub UI.

The deploy job runs `docs:build`, which is Lane 1 of the gate, so a doc example that stops
compiling against the pinned packages fails the deploy. Lane 2 is not on the deploy path.

Action versions are pinned by commit SHA with the tag in a trailing comment. Bump the SHA
and the comment together.

## Conventions

- New fence languages must be registered in `markdown.languages` in `config.mts`, or Shiki
  won't render them. `json` is required for twoslash type-hover popovers.
- New pages must be wired into `nav`/`sidebar` in `config.mts`.
- Canonical code repo is `eclipse-langium/langium-ai` — site links and the CHANGELOG link
  out there. The `langium-minilogo` fixture lives at `langium/langium-minilogo`. There is
  no `editLink` configured, so pages have no edit-this-page link; add one to
  `themeConfig` in `config.mts` if that's wanted.
- `plans/` and the VitePress `dist`/`cache` dirs are gitignored.
- American English in prose; start comments with a lowercase letter.
