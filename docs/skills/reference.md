---
description: "Reference skills give coding agents the background knowledge they need regarding Langium AI and Langium itself."
---

# Reference Skills

Reference skills carry background knowledge an agent draws on while working with LAI or with a
Langium project. They are marked `user-invocable: false`, so they're not intended to be run directly.
Instead, an agent should load them as context, and use those skills to inform how it reasons about your project throughout a session.
You can think of these as instructions and reference material that helps the [actionable skills](/skills/actionable) and the [CLI workflow](/skills/workflow) skills work more effectively (without duplicating the same information in each skill).

Both reference skills ship in the [`skills/`](https://github.com/eclipse-langium/langium-ai/tree/main/skills)
directory and are installed alongside everything else via `npx skills add
eclipse-langium/langium-ai` or the `langium-ai` plugin (see [Install](/skills/#install)).

## `lai`

A skill that functions as a guide to using the [`lai` CLI](/langium-ai/): commands, configuration, the evaluation
workflow, and result analysis.
It mirrors the CLI loop with per-step detail on `lai.config.jsonc`, the language descriptor, the system prompt, and the `.eval.ts` files.
It also includes details about how a provider is wired up in `evals/utils.ts`.

**When an agent should use it:** any time it's running `lai` commands, editing a descriptor,
writing or debugging evaluation files, or trying to understand what a given step of the loop
produces and why. It's the map to consult before the actionable `lai-gen-*` skills will make
sense.

Source: [`skills/lai/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/lai/SKILL.md)

## `langium`

Recipes, best practices, and troubleshooting for building, fixing, and improving Langium languages.
It's useful well beyond LAI, as a general guide an agent can rely on for any Langium DSL work.

The skill targets **Langium 4.x** and is verified against 4.4.0.
Langium 3.x and earlier are not supported; on those projects the agent says so and recommends upgrading first.

`SKILL.md` is a short hub. It orients the agent in a project, gives a mental model of the
build pipeline and a set of golden rules, and routes each task to one of ten references the
agent reads only when needed:

| Reference | Covers |
|---|---|
| `grammar.md` | Rules, `infix` expressions, cross-references, types, terminals, keyword conflicts |
| `project-setup.md` | Scaffolding, `langium-config.json`, the CLI, DI modules, entry points, bundling |
| `scoping.md` | Qualified names, imports between files, member access, builtin libraries, custom scoping |
| `validation.md` | Checks, uniqueness, document hooks, `slow` and custom categories, diagnostic codes |
| `lsp-features.md` | Formatter, semantic tokens, code actions, hover, completion, inlay hints, and more |
| `code-generation.md` | Generators from the AST, CLI generators, tracing |
| `testing.md` | `langium/test` tests for parsing, linking, validation, and LSP features |
| `multi-language.md` | Several languages in one project, cross-language references |
| `how-langium-works.md` | Build phases, `DocumentState`, DI, the generated `ast.ts`, AST utilities |
| `troubleshooting.md` | Parse errors, unresolved references, silent validators, missing editor features |

**When an agent should use it:** whenever it works in a project that depends on `langium` or
`langium-cli`, or when a Langium language misbehaves. This includes writing or changing a
grammar, adding scoping, validation, or editor features, writing tests, and debugging parse
errors or unresolved references. The generation skills lean on this knowledge to describe a
DSL correctly in a descriptor, prompt, or eval.

Source: [`skills/langium/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/langium/SKILL.md)
and [`skills/langium/references/`](https://github.com/eclipse-langium/langium-ai/tree/main/skills/langium/references)

## Where they fit

The two reference skills underpin the [actionable skills](/skills/actionable) and thread
through the whole [typical workflow](/skills/workflow). An agent keeps them in context while
it generates and refines the descriptor, system prompt, evals, and MCP server.
