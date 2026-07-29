# Actionable Skills

Actionable skills are marked `user-invocable: true`.
They're intended to be invoked directly to perform a specific generation or refinement task, or you let your agent decide when one fits. Each is a guided procedure: most bootstrap an artifact with a `lai gen ...` command when none exists, then walk you through refining it.
Where the [CLI generators](/langium-ai/usage) produce a first draft, these skills fill the gaps the generator can't always catch automatically; custom services it missed, examples it didn't find, and issues with the system prompt that are reflected by the limits of `lai`'s static generation.

All five ship in the [`skills/`](https://github.com/eclipse-langium/langium-ai/tree/main/skills)
directory and install via `npx skills add eclipse-langium/langium-ai` (see
[Install](/skills/#install)). They build on the [reference skills](/skills/reference), so an
agent is expected to load `lai` and `langium` for context while running any of these.

## `lai-gen-descriptor`

**Produces**, or refines, your `<language>.descriptor.yml`. This is the structured map of your
Langium project that every downstream artifact is built from.

**What it does:** If no descriptor exists, it bootstraps one with `lai gen descriptor` (or
`--fresh` to ignore an existing file). It then guides refinement of paths, services, examples,
documentation, and structure so the descriptor accurately represents your language.
In practice, the resulting descriptor is _much_ more accurate after running this skill than can be achieved statically.

**When to use:** You've run `lai init` and need the first descriptor, auto-detection missed
custom services or examples, referenced paths are wrong, the grammar or project structure
changed, or eval failures trace back to an incomplete descriptor.

Source: [`skills/lai-gen-descriptor/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/lai-gen-descriptor/SKILL.md)

Related: [`lai gen descriptor`](/langium-ai/usage)

## `lai-gen-sysprompt`

**Produces**, or refines, a system prompt (for example `<language>.sysprompt.md`) that
instructs an LLM how to generate valid code in your DSL.

**What it does:** If no prompt exists, it bootstraps one from the descriptor with
`lai gen sysprompt` (or `--fresh`), then guides targeted improvements.
It diagnoses recurring failure categories from evaluation results and addresses them using the grammar rules, validation
constraints, and scoping details.

**When to use:** You have a descriptor and need the first prompt, eval pass rates are low or
show recurring error patterns, the prompt is missing key language details, or the language has
changed since the prompt was last generated.

Source: [`skills/lai-gen-sysprompt/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/lai-gen-sysprompt/SKILL.md)

Related: [`lai gen sysprompt`](/langium-ai/usage)

## `lai-gen-evals`

**Produces** a comprehensive evaluation suite. The generated `.eval.ts` files are organized by category
(syntactic correctness, semantic validity, user-intent matching, edge cases, language
understanding).

**What it does:** This is the largest of the actionable skills — it expands beyond the placeholder
`basic.eval.ts` that `lai init` scaffolds into something that provides much better coverage.
Afterward, evaluations should measure not just whether an LLM emits syntactically valid code, but whether it produces semantically correct
programs that match user intent across a wide range of cases.

**When to use:** The starter eval is minimal, and you're ready to expand with specific cases in mind; pass rates are high
but shallow because cases are trivial or lack complexity, you've added language features that need
matching cases, the model produces valid-but-wrong output, or you're preparing an eval matrix
to compare providers or models.

Source: [`skills/lai-gen-evals/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/lai-gen-evals/SKILL.md)

Related: [Evals API](/langium-ai-tools/evals), [`lai evaluate`](/langium-ai/usage)

::: warning `evals/utils.ts` must be wired first
`lai-gen-evals` assumes `generateResponse()` in `evals/utils.ts` has been connected to a
provider. The placeholder `throw` should be replaced with a real OpenAI, Anthropic, or Ollama call.
Until it is, evaluations can't run against a model.

You can, however, ask an agent to wire this up as well.
:::

## `lai-gen-mcp`

**Produces** a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
your DSL's parser and validator as a `validate` tool. Any MCP-compatible client such as Claude Code,
Cursor, or VS Code can then send DSL source to the server and get back diagnostics (errors,
warnings, hints, information) from your language's real Langium services.

**What it does:** Locates your `create<Name>Services` function and language metadata, detects
whether the project is a monorepo (npm workspaces, pnpm, etc.) to choose the right output
location, and generates the `mcp/` server.

**When to use:** After `lai init` has run and set up a descriptor, or when you want to give an
MCP-capable assistant the ability to validate your DSL. Especially to build a feedback loop
where an LLM generates code and self-checks it via MCP.

Source: [`skills/lai-gen-mcp/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/lai-gen-mcp/SKILL.md)

Related: the reference implementation at
[`packages/langium-ai-mcp`](https://github.com/eclipse-langium/langium-ai/tree/main/packages/langium-ai-mcp)
and the [`mcp-server.ts` template](https://github.com/eclipse-langium/langium-ai/blob/main/packages/cli/templates/mcp-server.ts)

## `lai-gen-language-skill`

**Produces** a standalone skill document (a `SKILL.md`) that teaches an agent your specific
DSL. The generated skill should cover syntax, semantics, use cases, patterns, and pitfalls — all without needing the original project source at runtime.
This is a meta-skill: it uses the descriptor, grammar, examples, validator, scoping, tests, and system prompt to write a reusable knowledge artifact, and places it in your agent's skills directory (`.claude/skills/` by default).

**What it does:** Gathers the language's sources and distills them into a portable reference,
so a future agent (or a new team member) can get assistance in understanding your DSL syntactically, semantically, and practically.

**When to use:** After the descriptor and system prompt are generated and refined, when you
want a reusable knowledge artifact for onboarding agents or developers, or documentation that
goes deeper than a system prompt.

Source: [`skills/lai-gen-language-skill/SKILL.md`](https://github.com/eclipse-langium/langium-ai/blob/main/skills/lai-gen-language-skill/SKILL.md)

Related: the [`langium` reference skill](/skills/reference#langium), which the generated
skill complements

## Next

You can see how these chain with the CLI loop, and where evaluation results feed back into refinement of the descriptor
and prompt via the [Typical workflow](/skills/workflow) page.
