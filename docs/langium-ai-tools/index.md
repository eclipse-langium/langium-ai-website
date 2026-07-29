# langium-ai-tools

`langium-ai-tools` is the core library of Langium AI. It gives provider-agnostic building
blocks for AI features on top of a Langium DSL, building them out of services you already
have: parser, validator, grammar, etc. If your language can parse and validate a
program, this library can split it, score it, and analyze it.

The tools library assumes you have your own AI stack (model + everything around it), and doesn't provide anything explicitly in this regard. Everything here operates on messages, so it fits in with the standard APIs from Anthropic, OpenAI, and Google. Additionally, you can measure the performance of a RAG pipeline or a multi-step agent without much work.

::: info Library or CLI?
This page covers the **library** you import in code. The [`lai` CLI](/langium-ai/) is an evaluator workflow driver built on top of it, plus automatic project detection and setup mechanics. If you're just getting started, head over to the [Quickstart](/quickstart). If you want to build your own harness, this is the right spot.
:::

## Problems it solves

Langium AI tools seeks to solve the following:

- **Determining which models work well for your DSL**, with metrics grounded in your language's grammar and services.
- **Evaluating whether a change to your tooling actually improved generation results**, a new
  prompt, a retrieval tweak, a different model, scored the same way on each iteration.
- **Processing DSL documents in a way that makes sense for your DSL**, chunking and mapping
  along syntactic boundaries that respect the constructs of your language.

It's not limited to these three, but in practice most issues break down into the first, second, or third category.

## What's included

Each capability has its own entrypoint and its own page. There's a root barrel that re-exports
everything, but in practice you only need to import from the sub-paths for what you need.

| Capability | Import from | Key API |
|---|---|---|
| **[Splitter](/langium-ai-tools/splitter)** | `langium-ai-tools/splitter` | `splitByNode`, `splitByNodeToAst`, `ProgramMapper` |
| **[Evaluator](/langium-ai-tools/evaluator)** | `langium-ai-tools/evaluator` | `LangiumEvaluator`, `Evaluator`, `mergeEvaluators`, `EvalCase`, `loadFromYaml` |
| **[Evaluation matrix](/langium-ai-tools/evaluator#evaluation-matrix)** | `langium-ai-tools/evaluator` | `EvalMatrix`, `Runner`, averaging helpers |
| **[Evals API](/langium-ai-tools/evals)** | `langium-ai-tools/evals` | `describe`, `evaluation`, `evaluation.each`, lifecycle hooks, `EvalContext` |
| **[Analyzer](/langium-ai-tools/analyzer)** | `langium-ai-tools/analyzer` | `LangiumDocumentAnalyzer`, `AnalysisMode` |

More literally as imports:

```ts twoslash
import { splitByNode, ProgramMapper } from 'langium-ai-tools/splitter';
import { LangiumEvaluator, EvalMatrix } from 'langium-ai-tools/evaluator';
import { describe, evaluation } from 'langium-ai-tools/evals';
import { LangiumDocumentAnalyzer } from 'langium-ai-tools/analyzer';
```

### Splitter

Uses your parser to pre-process documents before ingest.
For example, into a vector DB, a context window, or anywhere else a whole program is not granular enough.
The splitter offers a few helpful parts:

- `splitByNode` chunks a document by node predicates and hands back text.
- `splitByNodeToAst` hands back the AST nodes instead, so you can do your own thing with them.
- `ProgramMapper` is a more fine-grained option, you give it mapping rules and it produces a condensed map of a program, which is useful when you want an outline of declarations or headers in the prompt rather than the raw source itself.

-> [Splitter](/langium-ai-tools/splitter)

### Evaluator

Evaluators are used to grade a model's output by running it through a series of checks.
Most often, the `LangiumEvaluator` is used, which grades a model's output by running it through your DSL services.
This parses programs, validates them, and forwards diagnostics (not unlike working with a language server directly).
Typical usage revolves around sub-classing `Evaluator` to build metrics specifically for your DSL: such as extracting code out of a chatty response, weighting certain diagnostics, or using an LLM as a judge.
In addition, `mergeEvaluators` allows sequencing several evaluators to produce a singular evaluation at the end, so you can run different sequences of evaluations.

**Evaluation matrix.** `EvalMatrix` effectively runs the cross product of runners × cases × evaluators, repeats each combination `num_runs` times, and writes timestamped reports you can average.
It's not unlike how you would specify a GitHub workflow, for example.

A *runner* is any function taking a prompt and a history that provides a response string.
It's the abstraction that allows different underlying approaches to be unified in an evaluation matrix.
In this way, it's easy to perform a regular model call via an API, use one in a RAG pipeline, or consume one in an agent workflow.

-> [Evaluator and evaluation matrix](/langium-ai-tools/evaluator)

### Evals API

The evals API is a vitest-style API containing common evaluation (testing) functions: `describe`, `evaluation`, `evaluation.each`, `beforeAll`/`afterAll`/`beforeEach`/`afterEach`, plus `.skip` and `.only`.
Evaluations are intended to be written into `*.eval.ts` files.
Each case returns a score between 0 and 1.
These are the files that `lai` discovers and runs, but the API belongs to this library, so you can also drive it yourself.

-> [Evals API](/langium-ai-tools/evals)

### Analyzer

The `LangiumDocumentAnalyzer` extends the `LangiumEvaluator` with grammar-coverage analysis tools: which of your grammar rules a document actually uses, plus diversity metrics (coverage, entropy, Gini, Simpson) over that usage.
Analyzer tools can be pointed at your example corpus, or at generated output to find what syntactic categories of your language are covered, and to identify those that are not covered at all, or covered insufficiently.

-> [Analyzer](/langium-ai-tools/analyzer)

## What's deliberately not covered

We try to be upfront with what langium-ai-tools doesn't cover. This keeps the scope of what's done here tight, and avoids interfering with what you have already set up on your end:

- **It doesn't choose your model.** That's your call, and the library does its best to not presume or lock you into any one choice. All it assumes is that you have a model or a stack it can score the output of.
- **It doesn't choose your stack.** Hosting providers, vector databases, caches, and more, are not chosen for you. There are
  many good options, local and remote, and they change fast. Rather than betting on a set of them (and putting development time into maintaining that bet), this library focuses on preparing information that's compatible for whichever you pick.
- **It ships no provider bindings.** No LlamaIndex, LangChain, OpenAI, or Anthropic adapters are here. This is entirely up to the AI stack you bring yourself.

LLMs and associated LLM tooling move quite quickly. Keeping model and library decisions out of langium-ai-tools keeps us nimble, and lets you swap in what you need without rewriting your evaluation setup.

## Next steps

- **[Install](/langium-ai-tools/install)**: add the library to your project, and pick the
  version that matches your Langium major.
- **[The `lai` CLI](/langium-ai/)**: the recommended route to auto-configure everything.
- **[Splitter](/langium-ai-tools/splitter)**, **[Evaluator](/langium-ai-tools/evaluator)**,
  **[Evals](/langium-ai-tools/evals)**, **[Analyzer](/langium-ai-tools/analyzer)**: the
  capability pages, each with working examples.
- **[Examples](/langium-ai-tools/examples)**: end-to-end usage, including provider wiring.
- **[CHANGELOG](https://github.com/eclipse-langium/langium-ai/blob/main/CHANGELOG.md)**: release history for tools and CLI.
