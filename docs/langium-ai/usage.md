# Command reference

Most `lai` commands are organized around the [refinement loop](/langium-ai/#the-refinement-loop).
The loop can be understood like so:
```
setup -> generate -> evaluate -> analyze -> maintain
```

Typically the first step runs once, and the last three or four are repeated as you refine prompts and modify your language.

For task-oriented walkthroughs (wiring a provider, comparing prompts) see [Examples](/langium-ai/examples), and for getting up and running see the [Quickstart](/quickstart).

::: tip Where eval *files* are documented
This page covers running and analyzing evaluations. The API you use to write the actual `.eval.ts`
files themselves lives in the library, on [`langium-ai-tools/evals`](/langium-ai-tools/evals).
:::

## Setup

### `lai init`

```bash
lai init [-y | --yes]
```

Bootstraps LAI in your Langium project, and performs a number of tasks:
- checks the Langium version
- detects the project structure
- asks for a project name
- requests to install `langium-ai-tools`
- writes `lai.config.jsonc`
- scaffolds `evals/`

See [Install](/langium-ai/install#3-first-run-setup-lai-init) for the full detection flow and the list of what gets created.

| Flag | Description |
|---|---|
| `-y`, `--yes` | Skip all prompts and use defaults (non-interactive / CI) |

If a config already exists, `init` asks before reinitializing (or proceeds as-is under `--yes`).

### `lai init config`

```bash
lai init config [-y | --yes]
```

Re-detects the project and rewrites `lai.config.jsonc`, leaving `evals/` untouched.
Destructive to the existing config file.

### `lai init evals`

```bash
lai init evals [-y | --yes]
```

Regenerates the `evals/` template files only (`basic.eval.ts`, `utils.ts`). Requires an existing
`lai.config.jsonc` — run `lai init` first if you don't have one. Destructive to the existing
`evals/` templates.

### `lai status`

```bash
lai status        # alias: lai s
```

Prints project configuration and which files are present and reachable.
This will report the project name, config path, whether the
descriptor and system prompt exist, and how many `.eval.ts` files are in the evaluations
directory. It's a fast way to see what's set up.

### `lai validate`

```bash
lai validate      # alias: lai v
```

Checks that the language descriptor is well-formed and that every file it references (grammars,
builtins, config, services/validators, examples, tests) actually exists on disk. Missing files
are reported as **warnings**, not errors, so validation still passes. Run it after editing
the descriptor by hand or after moving project files around. This reports an error if the descriptor itself is
missing or fails schema validation.

## Generate

### `lai gen descriptor`

```bash
lai gen descriptor [--fresh] [-y | --yes]
```

Detects your project structure and writes a structured YAML descriptor to the path recorded in
your config (`<project-name>.descriptor.yml`). The descriptor maps grammar paths, services,
validators, and up to three small example programs into one place. This allows downstream steps, like
prompt generation, to proceed without having to rediscover everything.

Descriptor generation is performed via static analysis. The output is a good starting
point, but review and hand-edit it afterward. The automatic detection won't pick up _everything_.
There's also an [`lai-gen-descriptor`](/skills/actionable#lai-gen-descriptor) agent skill for
producing or further improving your descriptor mapping.

| Flag | Description |
|---|---|
| `--fresh` | Overwrite an existing descriptor without prompting |
| `-y`, `--yes` | Skip prompts and use defaults |

::: warning `--yes` does not skip the overwrite prompt
If a descriptor already exists, `lai gen descriptor` asks before overwriting — and that prompt is
**not** suppressed by `-y`. Use `--fresh` to overwrite unconditionally in scripts or CI.
:::

### `lai gen sysprompt`

```bash
lai gen sysprompt [--fresh] [-y | --yes]
```

Reads the descriptor and writes a baseline system prompt to `sysprompt.path` from your config
(`<project-name>.sysprompt.md`). Generation is deterministic; it assembles the prompt from
the precomputed mapping in your descriptor. This reports an error if the descriptor doesn't exist yet, so be sure to run
`lai gen descriptor` beforehand.

| Flag | Description |
|---|---|
| `--fresh` | Overwrite an existing system prompt without prompting |
| `-y`, `--yes` | Skip prompts and use defaults (large validators are summarized automatically) |

#### How the prompt is assembled

By default the generator builds a markdown prompt from these sections, pulling in referenced project files.

| Section | Included when | Source |
|---|---|---|
| **Introduction** | always | descriptor `name` + `description` |
| **Grammar** | `grammar` path points at an existing `.langium` file | full grammar, inlined |
| **Built-in Library** | `builtins` path exists | built-in type/function definitions, inlined |
| **Validation Rules** | `services.validator` is set and exists | validator source (see inlining note below) |
| **Examples** | descriptor has an `examples` array | up to **3** examples (name, description, tags, content) |
| **Documentation** | descriptor has a `documentation` array | up to **2** entries, as links or file references |
| **Capabilities** | always | a standard section describing what the model can do with the language |

Keep in mind this is a best-effort attempt to build an initial system prompt.
This is not a substitute for a properly engineered prompt, or better yet one that varies based on the task & prompt at hand.
However, if you're not sure where to start with building prompts for Langium languages, then this is a good first step.

The descriptor fields that feed the prompt:

| Descriptor field | Prompt section | Required |
|---|---|---|
| `name` | Introduction, Capabilities | Yes |
| `description` | Introduction | Yes |
| `version` | Header | Yes |
| `grammar` | Grammar | Yes |
| `builtins` | Built-in Library | No |
| `services.validator` | Validation Rules | No |
| `examples` | Examples (first 3) | No |
| `documentation` | Documentation (first 2) | No |

::: tip Large validators are summarized
By default `lai` inlines the validator source verbatim, up to a size threshold. Above it, an
interactive run offers to emit a summarized map of checks instead of the raw source.
This keeps implementation details out of the prompt and stops it from becoming oversized.
Under `--yes`, large validators are summarized automatically. In multi-language projects, validators are picked up per language, so the Validation Rules section can appear for each language entry.
:::

**Best practices:** keep the descriptor accurate (run `lai validate`), keep examples concise but rich syntactically and semantically, include any language guides via `documentation`, and iterate on it.

## Evaluate

### `lai evaluate`

```bash
lai evaluate [paths...] [options]     # aliases: lai eval, lai e
```

Discovers `.eval.ts` files, loads the system prompt pointed to in your config, and runs all cases against it, then
persists a scored run under `.langium-ai/`. With no args it uses the configured
`evaluations.directory`. Directory arguments are scanned non-recursively for `.eval.ts`
files, and duplicates are dropped (first occurrence wins).

| Flag / arg | Description |
|---|---|
| `[paths...]` | Eval files or directories to run (defaults to the configured evals directory) |
| `--sysprompt <path>` | Use the given system prompt instead of the one in config |
| `--output <path>` | Write the output JSON here instead of the `.langium-ai/` location |
| `--verbose` | Show more per-case detail (score, duration, data) as each completes |
| `--list` | List and count discovered files, suites, and cases without running anything |

```bash
# list what would run, without running it
lai eval --list

# save results to a specific file
lai evaluate --output results.json

# per-case detail as each completes
lai evaluate --verbose

# run against a custom system prompt (for A/B comparison)
lai evaluate --sysprompt ./prompts/experimental.txt

# run specific files or directories (positional)
lai evaluate ./custom-evals
lai evaluate ./evals/basic.eval.ts ./evals/edge-cases.eval.ts

# combine
lai evaluate --sysprompt ./test-prompt.md --output results.json --verbose
```

#### Scoring

Every case returns a `score` between 0 and 1. In the output each case is colored by its score:

| Score | Marker |
|---|---|
| `>= 0.8` | ✓ green |
| `>= 0.5` | ~ yellow |
| `< 0.5` | ✗ red |

Any case scoring below 0.5 makes `lai evaluate` exit non-zero (as does an evaluation that
throws).

#### Output

Runs print out details while running, per file, with pass counts, then each case with its marker and
score. Once done, a summary block is reported (total, ran, skipped, average duration, total time, average score,
score range) and a list of any low-scoring cases with their errors.

The example output below is roughly what you can expect to see:

```
ℹ Running 3 evaluation case(s) across 1 file(s)...

✔ basic.eval.ts: avg 100.0% (3 cases)
  ✓ Basic Code Generation Evaluation Examples > should generate a simple program (100.0%)
  ✓ Basic Code Generation Evaluation Examples > should match expected output similarity (100.0%)
  ✓ Code Explanation Examples > should explain code correctly (100.0%)

============================================================
Summary
============================================================
Total: 3
Ran: 3
Average duration: 0ms
Total time: 12ms
Average score: 100.0%
Score range: 100.0% - 100.0%
✔ Results saved to: .langium-ai/eval-… (Run #1)
```

This is an illustrative format, so these aren't real numbers from an actual run. The perfect `100.0%`
scores here are what the scaffolded [stub cases](/langium-ai/examples#writing-your-first-real-evaluation) return
before you wire up a real evaluation. This baseline is there to make it easy to verify the evaluations work after generation.
Your suite names, case counts, scores, and run path will differ in practice.

#### Result storage

Unless `--output` is given, each run is saved to `.langium-ai/eval-YYYY-MM-DD-HH-mm-ss.json`
with the following:

- `runId`: auto-incremented run number (`maxExistingId + 1`, starting at 1)
- `timestamp`: ISO date string
- `tags`: empty by default (add with `lai tag`)
- `syspromptPath`: absolute path to the system prompt used
- `totalTime`: duration in milliseconds
- `results`: array of case results, each with `metadata` (`suiteName`, `caseName`, `duration`)
  and `data` (`score`, optional `skipped`/`error`, plus any custom fields your case returned)

Wherever a command takes a run reference, you can pass a numeric run ID, the keyword `latest`, or a path to a saved result file.

## Analyze

### `lai history`

```bash
lai history [--limit <n>] [--oneline]      # alias: lai h
```

Lists past runs, ordering by newest first.
It's useful for tracking trends as you change prompts, manage context, evaluations, or
the model itself. Each run shows its ID, timestamp, tags, case/skipped counts, average score, score range,
average duration, and total time.

| Flag | Default | Description |
|---|---|---|
| `--limit <n>` | `10` | Number of runs to show |
| `--oneline` | — | Condensed single-line-per-run format (good for scripting) |

### `lai show`

```bash
lai show <id | latest | path> [--verbose]
```

Prints full results for one run: metadata (timestamp, sysprompt path, tags), a summary (counts,
average score, score range), and every case with its marker and score. `--verbose` adds per-case
duration, error messages, and all data fields.

```bash
lai show latest
lai show 5
lai show results-v1.json
lai show latest --verbose
```

### `lai compare`

```bash
lai compare <id1> <id2>
```

Compares two runs to each other. This looks at the average score, average duration, and total time (each with a
delta), plus a per-case change list (NEW, REMOVED, and CHANGED cases). Either argument can be an ID, `latest`, or a path to a results file.

```bash
lai compare 3 5
lai compare 3 latest
lai compare latest results-v1.json
```

### `lai stats`

```bash
lai stats [--tag <tag>]
```

Aggregate statistics across all runs (optionally filtered by a tag).
Returns total runs, total evals, ran/skipped counts, average score and duration, best and worst run, a small recent-trend bar chart of the last few runs, and a tally of runs per tag.

```bash
lai stats
lai stats --tag baseline
```

### `lai export`

```bash
lai export <id | latest> [--format csv|json] [--output <path>]
```

Exports a run for external analysis.
The default export format, CSV, emits the rows `Suite,Case,Score,Skipped,Duration,Error`.
The JSON format emits the full run object, pretty-printed.
Without `--output`, the data is written to stdout.

| Flag | Default | Description |
|---|---|---|
| `--format <format>` | `csv` | Output format: `csv` or `json` |
| `--output <path>` | stdout | File to write to instead of stdout |

```bash
lai export latest                              # CSV on stdout
lai export latest --output results.csv
lai export 5 --format json --output run-5.json
```

### `lai tag`

```bash
lai tag <id | latest | path> <tags...>
```

Adds one or more tags to a run (writing back to its JSON file). The same
tag can appear on multiple runs, which lets you group related experiments and filter by them when running `lai stats`.

```bash
lai tag latest baseline production
lai tag 5 experimental feature-x
```

## Maintain

### `lai clean`

```bash
lai clean (--keep <n> | --before <id>) [--yes]
```

Prunes old evaluation runs. You must pass either `--keep` or `--before`. By default it lists the
runs it will delete and asks for confirmation; `--yes` skips the prompt.

| Flag | Description |
|---|---|
| `--keep <n>` | Keep the N most recent runs, delete the rest |
| `--before <id>` | Delete all runs with an ID below this one |
| `--yes` | Skip the confirmation prompt |

```bash
lai clean --keep 10        # keep only the 10 most recent runs
lai clean --before 20      # delete all runs before ID 20
lai clean --keep 5 --yes   # skip confirmation
```

::: danger This _permanently_ deletes run files
`lai clean` removes run JSON files from `.langium-ai/` without a way to recover them (assuming they're not checked in). A confirmation prompt guards it unless you pass `--yes`.
If you version-control your run history (recommended), then this is less of a concern.
:::

## Configuration

`lai.config.jsonc` is the source of truth, written by `lai init` and read by every command that
needs project context.

Here's an example config for a language called Minilogo:

```jsonc
{
  "version": "0.4.0",
  "langium": {
    "configPath": "langium-config.json",
    "languages": [
      { "id": "minilogo", "grammarPath": "src/language/minilogo.langium", "caseInsensitive": false }
    ]
  },
  "descriptor": { "path": "minilogo.descriptor.yml" },
  "sysprompt": { "path": "minilogo.sysprompt.md" },
  "evaluations": { "directory": "evals" },
  "project": { "name": "minilogo" }
}
```

- **`langium.languages[]`**: one entry per registered language, so multi-language projects are covered.
- **`descriptor.path` / `sysprompt.path`**: descriptor and default sysprompt to use
- **`evaluations.directory`**: the default directory `lai evaluate` scans.
- **`project.name`**: passed to eval cases as `ctx.project.name`.

Run history is stored under **`.langium-ai/`**, with one timestamped JSON file per run.

::: tip Outdated-config detection
If `lai` loads a config in an older format, it warns and points you at `lai init config` to
regenerate it. Keeping the config current will avoid issues if you've moved or changed what it should be pointing to.
:::

## Next steps

- **[Examples](/langium-ai/examples)**: the evaluation workflow end to end, wiring a provider,
  and A/B-comparing prompts.
- **[Authoring eval files](/langium-ai-tools/evals)**: the `describe` / `evaluation` API used
  inside `.eval.ts` files.
- **[`langium-ai-tools`](/langium-ai-tools/)**: the library the CLI runs on.
