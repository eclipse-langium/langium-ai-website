# Install

`langium-ai-tools` is a library which helps to guide the development of AI applications that leverage Langium DSLs.
It contributes functionality to perform evaluation, analysis, and program splitting.

Ideally, you should already have a Langium language project in mind that you'd want to add this to.
If you don't, you can always set up a fresh one using [Langium's installation guide](https://langium.org/docs/learn/workflow/install/).

::: tip Looking for a command to run?
That's the [`lai`](/langium-ai/install) CLI, published as `langium-ai`. It's responsible for driving the automated configuration and setup of both tools and evaluations, and it leverages this package to do so.
`lai init` also offers to install this library into your project for you.
:::

## Install

Installation is straightforward from npm:

```bash
npm i --save langium-ai-tools
```

Or with your package manager of choice:

```bash
# pnpm
pnpm add langium-ai-tools

# yarn
yarn add langium-ai-tools
```

## Requirements

- **Node.js** >= 22.0.0
- `langium` >= 4.0.0 (peer dep)
- ESM-only ([see below for details](#esm-only))

Langium is a peer dependency so we can re-use *your* language's services.
Versions vary, but the surface API is quite consistent.
We mark it as a peer so we can run against your version of Langium, rather than pulling in an additional (and potentially breaking) version.

### Version alignment with Langium

The current `langium-ai-tools` line is **5.x**, and it accepts any Langium 4.x via the peer
range above.
On the older `langium-ai-tools` versions (**4.x** and lower), we tracked Langium majors more literally.
So generally we would recommend being on the **5.x** line at the minimum.

Langium 3.x and earlier are not explicitly supported.

### ESM only

This package doesn't provide a CommonJS entry, so `require('langium-ai-tools')` won't resolve. Your consuming code has to
be ESM (or reach it through a dynamic `import()`).

This matters most for eval files. `lai evaluate` loads `.eval.ts` files that import your language services, so your language project should be
ESM-importable.

## Entrypoints

Everything is re-exported from the root barrel file, but the subpath exports are what the docs are
written against. They keep imports narrow and make it obvious which capability a file depends
on.

| Import specifier | Covers | Page |
|---|---|---|
| `langium-ai-tools` | Root barrel that re-exports all of the below, plus the generated message types | — |
| `langium-ai-tools/splitter` | `splitByNode`, `splitByNodeToAst`, `ProgramMapper` | [Splitter](/langium-ai-tools/splitter) |
| `langium-ai-tools/evaluator` | `Evaluator`, `LangiumEvaluator`, `EvalMatrix`, `Runner`, `EvalCase`, `mergeEvaluators`, `loadFromYaml`, and averaging logic | [Evaluator](/langium-ai-tools/evaluator) |
| `langium-ai-tools/evals` | `describe`, `evaluation`, `evaluation.each`, lifecycle hooks, `EvalContext`, `runEvalFile` | [Evals](/langium-ai-tools/evals) |
| `langium-ai-tools/analyzer` | `LangiumDocumentAnalyzer`, `AnalysisMode` | [Analyzer](/langium-ai-tools/analyzer) |

## Bundled dependencies

Three runtime dependencies come along with the install as well:

- **`yaml`**: for parsing evaluation cases from YAML (`loadFromYaml`).
- **`@protobuf-ts/runtime`**: the generated message types used by the analyzer's statistics.
- **`tsx`**: the loader the eval runner registers to `import()` `.eval.ts` files
  directly.

## Next steps

- **[Overview](/langium-ai-tools/)**: outlines what each capability is for.
- **[Evals](/langium-ai-tools/evals)**: the API you'll import first if you're writing
  `.eval.ts` files.
- **[Quickstart](/quickstart)**: the guided path via the `lai` CLI.
