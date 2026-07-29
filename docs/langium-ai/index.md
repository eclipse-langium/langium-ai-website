# langium-ai (the `lai` CLI)

The Langium AI CLI (`lai`) is the command-line front end for Langium AI.
It bootstraps `langium-ai-tools` around a [Langium](https://langium.org/) DSL, and gives you an evaluation loop to refine your AI apps.
It detects your project, helps to map out your language project, synthesizes a default system prompt, runs evaluations, and tracks your results over time as you make changes.

If you're building a coding assistant, an agent, or any other LLM-driven workflow for a
Langium-based language, `lai` gives you the means to reliably build and assess your AI application.

::: info CLI or library?
This section covers the **`lai` CLI**, which is a workflow driver that's built on top of [`langium-ai-tools`](/langium-ai-tools/).
Generally, it can be helpful to use the CLI to bootstrap the process, even if you just use the library.
If you want the fast path to a running evaluation (which also uses the CLI), head to the [Quickstart](/quickstart).
:::

::: tip Package name vs. command name
The npm package for the CLI is `langium-ai`, but the binary it installs is `lai`.
Everywhere in these docs "the `lai` CLI" and `langium-ai` refer to the same thing.
:::

## Why it exists

The Langium AI CLI exists to make it easier to install and integrate `langium-ai-tools`, map out your project for an LLM to handle later, and to run evaluations. All of this serves the purpose of getting an LLM to work well with your DSL.

On that note, there are many ways to get an LLM to reliably generate valid code for a DSL. Your needs will vary, but the requirements are often the following:

- A sufficiently capable LLM, to build off of
- A context management system, to provide sufficient information for the desired use case(s)
- A suite of evaluations that measure output quality and track changes over time

Building these parts for every project can be time-consuming and prone to subjective assessment.
Having a means by which you can measure and ensure your changes don't just *feel* right, but are measurably improving your results helps ensure success down the road.
`lai` factors out most of the plumbing so you can make changes, track tightly with your DSL, and check your work without getting bogged down in the low-level details.

## The refinement loop

`lai` can be leveraged most effectively when you use it in an evaluation loop, incrementally expanding and refining your AI tooling.
From setup to evaluation, the workflow proceeds roughly in the following order:

1. **`lai init`**: detects your Langium project structure, installs `langium-ai-tools`, and
   scaffolds an `evals/` directory with starter files. You can also reinitialize parts individually
   with `lai init config` (config only) or `lai init evals` (evals only).
2. **`lai gen descriptor`**: generates a structured YAML descriptor that maps your grammar,
   language services, validators, and examples into a form suited to prompt generation. This form is not only capable of being processed programmatically, but it's excellent for feeding into an LLM later to understand your language and its project layout.
3. **`lai gen sysprompt`**: synthesizes a system prompt from the descriptor.
4. **`lai evaluate`**: runs your evaluation suite against a system prompt via your configured
   provider, recording a score and timing for each case. By default, this will be the system prompt you synthesized earlier.
5. **Analyze & refine**: review results with `lai show`, `lai compare`, and `lai stats`, then
   iterate on the descriptor and prompt, and evaluate again.

Every evaluation run is persisted locally under `.langium-ai/`.
So you can track trends, compare prompt versions, tag runs of interest, and spot improvements or regressions over time.

Just to recap:

- `lai init`: detect project · scaffold evals · install tools
- `lai gen descriptor`: map grammar / services / examples -> YAML
- `lai gen sysprompt`: descriptor -> system prompt
- `lai evaluate`: run .eval.ts cases · persist a scored run
- `lai show/compare/stats/tag`: analyze, then refine & repeat

## Command surface at a glance

Grouped by where they fall in the loop. See the [command reference](/langium-ai/usage) for the
full synopsis, flags, and examples for each command.

| Group | Commands | What it's for |
|---|---|---|
| **Setup** | `init`, `init config`, `init evals`, `status`, `validate` | Set up the project, configs, and evals, plus sanity checks |
| **Generate** | `gen descriptor`, `gen sysprompt` | Build the YAML descriptor and synthesize a system prompt from it |
| **Evaluate** | `evaluate` (alias `eval`, `e`) | Discover and run `.eval.ts` cases against a system prompt, and persist scored runs |
| **Analyze** | `history`, `show`, `compare`, `stats`, `export`, `tag` | Inspect, compare, aggregate, and label past runs |
| **Maintain** | `clean` | Clean up run history |

Most setup and generation commands accept `-y` / `--yes` to skip interactive prompts and take defaults.
This is helpful for CI and scripted runs.
`lai help` (or `lai <command> --help`) also prints the actual available usage at any time.

## Multi-language projects

`lai` supports Langium projects that register more than one language.
During detection it maps each entry under `langium.languages[]` in the `lai` config (`lai.config.jsonc`), and per-language validators are discovered as well.
In this case, `lai gen sysprompt` can add validation rule sections per language, rather than assuming a single validator.
Even in multi-language projects, `lai` always expects one `langium-config.json`, which it uses as the anchor for mapping your project's structure.

## Works with agent skills

`lai` ships alongside [agent skills](/skills/) that equip coding agents (such as Claude Code, Codex,
Gemini, and Copilot) with the information they need to work with `lai`, `langium-ai-tools`, and Langium projects generally.
Pairing skills with `lai` is a particularly effective combination: the CLI gets you a baseline descriptor and prompt quickly, and an agent can fill the gaps the static generators may miss — refining the descriptor, improving the prompt, or expanding the eval suite.
See [Agent skills](/skills/) for the full list.

## Next steps

- **[Install](/langium-ai/install)**: install the `lai` binary and run the one-time project
  setup.
- **[Command reference](/langium-ai/usage)**: every command, flag, and its output.
- **[Examples](/langium-ai/examples)**: an end-to-end evaluation workflow, how to wire a provider,
  and compared prompt strategies.
- **[Quickstart](/quickstart)**: the fastest way to get everything set up in a Langium project.
- **[`langium-ai-tools`](/langium-ai-tools/)**: the library the CLI is built on. Eval files use its [evals API](/langium-ai-tools/evals).
