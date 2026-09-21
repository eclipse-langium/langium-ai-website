# Reference Skills

Reference skills carry background knowledge an agent draws on while working with LAI or with a
Langium project. They are marked `user-invocable: false`, so they're not intended to be run directly.
Instead, an agent should load them as context, and use those skills to inform how it reasons about your project throughout a session.
You can think of these as instructions and reference material that helps the [actionable skills](/skills/actionable) and the [CLI workflow](/skills/workflow) skills work more effectively (without duplicating the same information in each skill).

Both reference skills ship in the [`skills/`](https://github.com/eclipse-langium/langium-ai/tree/main/skills)
directory and are installed alongside everything else via `npx skills add
eclipse-langium/langium-ai` (see [Install](/skills/#install)).

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

A comprehensive reference for how Langium projects work, covering grammar definition, code generation, the dependency-injection system, lexing and parsing, the document lifecycle, scope computation and name resolution, linking and cross-references, validation, workspace management, and LSP
integration.
It's the largest skill in the set and is useful well beyond LAI.
It's a general Langium primer an agent can rely on for any Langium DSL work.

**When an agent should use it:** whenever it needs to understand or modify the language
itself. This includes: reading a grammar, tracing how a document is parsed and validated, debugging scoping
or linking, or explaining a language feature accurately. The generation skills lean on this
knowledge to describe a DSL correctly in a descriptor, prompt, or eval.

Source: [`skills/langium/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/langium/SKILL.md)

## Where they fit

The two reference skills underpin the [actionable skills](/skills/actionable) and thread
through the whole [typical workflow](/skills/workflow). An agent keeps them in context while
it generates and refines the descriptor, system prompt, evals, and MCP server.
