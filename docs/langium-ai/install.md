# Installing `lai`

Getting set up with Langium AI can be done in a couple of steps: installing `langium-ai`, then running `lai init` to get everything going.
The first puts `lai` on your `PATH`, and the second wires up `lai` into a specific project.

If you just want to get started quickly, check out the [Quickstart](/quickstart).
That walks through only what you need.
This dives into a bit more detail, but covers the same ground.

## 1. Install the CLI

```bash
npm install -g langium-ai
```

The `langium-ai` package installs the `lai` binary.
You can install locally as well, per your preference.

Then, confirm it's on your `PATH`:

```bash
lai --version
lai --help
```

`lai help` (or `lai <command> --help`) prints usage for any command.

## 2. Prerequisites

Before running `lai init`, your project should meet a few requirements:

- **Node.js `22` or newer.**
- **Langium `4.x` or newer.** `lai` checks the project's Langium version up front. Older versions
  have API differences that may be incompatible or behave erroneously, so it warns and sets a
  non-zero exit code. Detection will prefer the Langium version you have installed in `node_modules`, falling back to the range declared in `package.json`.
- **ESM-importable language services.** `lai evaluate` registers the `tsx/esm` loader and
  dynamically `import()`s your `.eval.ts` files, which in turn import your
  `create<Name>Services` function. A CJS-only project, or non-ESM service exports, will not work during evaluation.
  We recommend setting up an ESM-compatible project, as Langium uses ESM as well.
- **A built project.** Make sure you've run `langium:generate` and `build` steps so the
  generated artifacts from your grammar are present (and up to date).
- **Exactly one reachable `langium-config.json`.** `lai` uses it to map your project's
  structure. Multi-project repos are fine, but run `lai init` from the package that contains the
  grammar, not a monorepo root that can see several configs.

::: warning ESM is required
`lai` imports your language services as ES modules. If your project isn't configured for ESM,
`lai evaluate` will fail to import the eval file. If an eval fails to load, this may be the cause.
:::

## 3. First-run setup: `lai init`

From your project root:

```bash
lai init
```

`init` runs an interactive setup that:

1. **Checks your Langium version**: warns (and sets a non-zero exit code) if it's older than
   `4.0.0`.
2. **Detects your project structure**: locates your `langium-config.json`, the registered
   languages, core module, and all custom services it can find (parser, documentation,
   references, serializer, validation, and LSP services).
3. **Asks for a project name**, defaulting to your `package.json` name. This name determines your
   descriptor and system-prompt filenames.
4. **Offers to install `langium-ai-tools`** using the package manager it detects (npm or pnpm).
   This is required for evaluations to work.
5. **Scaffolds `evals/`** with starter files.

### What gets created

| Path | Created by | What it is |
|---|---|---|
| `lai.config.jsonc` | `lai init` | Project config: languages, descriptor/sysprompt paths, evals directory, project name |
| `evals/utils.ts` | `lai init` | Provider stub (`generateResponse`) plus various helpers (e.g. `extractCodeBlock`, `calculateSimilarity`) |
| `evals/basic.eval.ts` | `lai init` | Stubbed example evaluations, generated against your detected services |
| `<project-name>.descriptor.yml` | later, by `lai gen descriptor` | The generated language descriptor (recorded in the config) |
| `<project-name>.sysprompt.md` | later, by `lai gen sysprompt` | The synthesized system prompt |
| `.langium-ai/` | first `lai evaluate` | History folder for all runs, where each run is a timestamped JSON file |

`lai init` also adds `langium-ai-tools` to your project's dependencies (unless you decline the
install). _Keep in mind that this is required to run the `eval` command._

For reference, here's what a generated `lai.config.jsonc` might look like:

```jsonc
{
  "version": "0.4.0",
  "langium": {
    "configPath": "langium-config.json",
    "languages": [
      {
        "id": "minilogo",
        "grammarPath": "src/language/minilogo.langium",
        "caseInsensitive": false
      }
    ]
  },
  "descriptor": { "path": "minilogo.descriptor.yml" },
  "sysprompt": { "path": "minilogo.sysprompt.md" },
  "evaluations": { "directory": "evals" },
  "project": { "name": "minilogo" }
}
```

The config is a `jsonc` file, so feel free to comment or annotate it as you prefer.

::: tip Keep the config current
If `lai` detects an outdated `lai.config.jsonc`, it'll warn and ask you to run `lai init config`
to regenerate it in the current format. `lai status` is a quick way to see whether your config,
descriptor, prompt, and evals are all up to date.
:::

## 4. Reinitializing part of the setup

You don't have to redo everything to fix one outdated part.
For example, you can reinitialize just the config and evals:

```bash
# re-detect the project and rewrite lai.config.jsonc only
lai init config

# regenerate the evals/ templates only (requires an existing config)
lai init evals
```

::: warning Reinitialization is destructive!
Both rewrite the file or directory they target, and they won't preserve your existing edits. Make sure
that's what you want before you proceed.
It's recommended you either check in or at least back up your files before running this command.
:::

## 5. Non-interactive / CI setup

The setup and generation commands accept `-y` / `--yes` to skip prompts and opt for the defaults, such as the detected project name, auto-installing `langium-ai-tools`, and so on:

```bash
lai init --yes
lai init config -y
lai gen descriptor -y
```

::: warning `--yes` doesn't suppress the descriptor overwrite prompt
`lai gen descriptor` still asks before overwriting an existing descriptor even under `-y`. To
overwrite unconditionally in a script, use `--fresh` instead. (See the [command reference](/langium-ai/usage#generate) for the full generation behavior.)
:::

## Next steps

- **[Command reference](/langium-ai/usage)**: all commands and flags.
- **[Examples](/langium-ai/examples)**: the evaluation workflow from end-to-end, including wiring a
  provider into `evals/utils.ts`.
- **[`langium-ai-tools` install](/langium-ai-tools/install)**: the core library that `lai init` pulls in.
