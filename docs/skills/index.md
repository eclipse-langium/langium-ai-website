---
description: "Agent skills that equip Claude Code, Codex, Gemini, Copilot, and other coding agents to work with the Langium AI toolkit and Langium projects."
---

# Agent Skills

Agent skills are Langium AI's third contribution, alongside the [`langium-ai-tools`](/langium-ai-tools/) library and the [`lai` CLI](/langium-ai/).
They are [markdown documents](https://agentskills.io/home) that coding agents, such as Claude Code, Codex, Gemini, Copilot, and others, can load as context to work with the LAI toolkit and with Langium projects in general.
Nothing here is compiled or executed on your machine — a skill is predominantly information an agent reads to do a better job.

If you're unfamiliar with agent skills, check out the [agent skills overview page](https://agentskills.io/home) for an introduction.

Pairing skills with LAI is a particularly powerful combination.
The CLI gives you the generators and the evaluation loop, while the skills equip an agent with the ability to drive that loop, know how a Langium project is put together, and produce the descriptor, system prompt, evals, and MCP server that the workflow depends on.
They factor out the common software-engineering patterns around LAI so an agent can carry those tasks out for you, instead of you doing it by hand.

## Install

We recommend you install these skills into your project with the [`skills`](https://www.npmjs.com/package/skills) package:

```bash
npx skills add eclipse-langium/langium-ai
```

The `skills` package detects your agent and installs into the correct directory
automatically. This is also the recommended route for OpenCode, which reads skills from
`.agents/skills` and `.claude/skills`. If you'd rather install by hand, copy the skill folders from the
[`skills/`](https://github.com/eclipse-langium/langium-ai/tree/main/skills) directory of the
repository into your agent's skills directory (for example `.claude/skills/`).

### As a plugin or extension

You can instead install all skills as a single versioned plugin, named `langium-ai`, through your agent's own plugin system:

| Agent | Install |
|---|---|
| Claude Code | `/plugin marketplace add eclipse-langium/langium-ai`, then `/plugin install langium-ai@langium-ai` |
| Codex | `codex plugin marketplace add eclipse-langium/langium-ai`, then install `langium-ai` from the plugin directory |
| Gemini CLI | `gemini extensions install https://github.com/eclipse-langium/langium-ai` |
| Pi | `pi install git:github.com/eclipse-langium/langium-ai` |

Each plugin version is listed in the [CHANGELOG](https://github.com/eclipse-langium/langium-ai/blob/main/CHANGELOG.md) under its "agent skills" entry.

## Two categories

The shipped skills fall into two groups: you can split them up by whether you invoke them directly or not.

### Reference skills

Background knowledge an agent draws on while working. These are typically not invoked directly, but they are pulled in to supplement an agent's context throughout a session when deemed necessary.

| Skill | Description |
|---|---|
| **lai** | Guide for using the LAI CLI: commands, configuration, evaluation workflow, and analysis |
| **langium** | Build, fix, and improve Langium 4.x languages: recipes, best practices, and troubleshooting for grammars, scoping, validation, LSP features, code generation, testing, and multi-language projects |

You can jump straight to the [Reference skills](/skills/reference) to read them in more detail.

### Actionable skills

User-invocable skills that perform a specific generation or refinement task. You can invoke
them yourself, or let your agent decide when they're needed.

| Skill | Description |
|---|---|
| **lai-gen-descriptor** | Generate or refine your `<language>.descriptor.yml` |
| **lai-gen-sysprompt** | Generate or refine a system prompt |
| **lai-gen-evals** | Expand the evaluation suite with comprehensive coverage |
| **lai-gen-mcp** | Generate an MCP server exposing your DSL's parser and validator |
| **lai-gen-language-skill** | Produce a standalone skill that teaches an agent your DSL |

You can go straight to the [Actionable skills](/skills/actionable) to read them in more detail.

## How they fit together

The reference skills give an agent the context it needs, and the actionable skills do the work.
Each skill maps onto a step of the CLI loop (init, generate, evaluate, refine).
The [Typical workflow](/skills/workflow) page walks the whole chain front to back, from `lai init` through a generated language skill.
