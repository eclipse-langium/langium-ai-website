# Examples

The capability pages show how to leverage the tools of `langium-ai-tools` separately.
This page puts them together in examples for demonstration.
The first is a small end-to-end script you can run immediately, followed by a tour of the full example project that lives in the repo itself.

## Scoring a batch of candidate outputs

The most common form for a first evaluation script is to take some candidate outputs, grade each one
against your language, and observe the spread.
This example is self-contained for this purpose.
It uses the Langium grammar language as its DSL, so it runs without a project of your own.
Swap `createLangiumGrammarServices(...).grammar` for your `createMyDslServices(...).MyDsl` and it should work against your own language.

```ts twoslash
const expectedResponse: string = 'a reference program to compare against';
// ---cut---
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import { LangiumDocumentAnalyzer } from 'langium-ai-tools/analyzer';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const evaluator = new LangiumEvaluator(services);
const analyzer = new LangiumDocumentAnalyzer(services);

// stand-ins for model output — in a real script these come from your provider
const candidates = [
    { name: 'valid', text: `grammar A\nentry Model: 'a' name=ID;\nterminal ID: /\\w+/;` },
    { name: 'unresolved-ref', text: `grammar C\nentry Model: 'c' name=MISSING;` },
    { name: 'not-a-program', text: `Not a valid program here.` }
];

for (const candidate of candidates) {
    const result = await evaluator.evaluate(candidate.text, expectedResponse);
    const { errors, warnings, failures } = result.data;

    // errors are expensive, warnings are cheap, an unbuildable document scores zero
    const score = failures ? 0 : Math.max(0, 1 - errors * 0.25 - warnings * 0.05);

    const stats = analyzer.extractStatisticsFromResult(await analyzer.evaluate(candidate.text, expectedResponse));

    console.log(
        `${candidate.name}: score=${score.toFixed(2)} errors=${errors} ` +
        `coverage=${stats?.coverage.toFixed(1)}%`
    );
}
```

```
valid: score=1.00 errors=0 coverage=31.9%
unresolved-ref: score=0.75 errors=1 coverage=22.2%
not-a-program: score=0.00 errors=5 coverage=18.1%
```

You can see above the `valid` program gave a score of `1`, but low coverage. The unresolved ref gave `0.75` with a single unresolved reference, and a slightly lower coverage. The `not-a-program` example was, of course, the lowest of all of these in every respect (except for error counts!).

Note that the `not-a-program` example didn't fail outright — it just produced 5 parser errors.

The full zero case occurs only for documents that couldn't be built at all, such as those that actually lead to a crash internally.

Fenced code blocks are handled for you, so passing a raw model response with text and a
` ```langium ` code block around the program will score the same as passing the bare program to the `LangiumEvaluator`.

## The example project in the repo

[`packages/examples/example-dsl-evaluator`](https://github.com/eclipse-langium/langium-ai/tree/main/packages/examples/example-dsl-evaluator) is a fully worked example.
It uses multiple local models and compares them against a shared case set, with and without retrieval, scored by several evaluators at once and rendered as a radar chart.
It's the main project both READMEs point at for practical reference.

Like the short script above, it uses the **Langium grammar language** as the DSL under test.
The evaluations then ask each model to write Langium grammars, and grades them with Langium's own parser and validator.

### What's in the examples?

| File | What it shows |
|---|---|
| `src/runners.ts` | Runners for Ollama and OpenAI models, plus a RAG runner that performs lookups via ChromaDB. This helps to demonstrate how a runner can be a larger pipeline, not just a one-shot model call. |
| `src/langium-cases.ts` | Set of cases for evaluation. Prompts paired with expected grammars, loaded as `EvalCase[]` in code. |
| `src/edit-distance-evaluator.ts` | A custom `Evaluator` that computes the edit distance (Levenshtein) as a similarity metric between response and expected. |
| `src/embedding-evaluator.ts` | A custom `Evaluator` that scores semantic similarity using an embedding model. |
| `src/eval-langdev.ts` | The LangDev demo: several model runners, merged evaluators, and a radar chart of the results. |
| `src/eval-langium.ts` | The larger comparison, run with and without RAG. |
| `src/example-splitter.ts` | Splitting a grammar document by rule, including how attached comments land in chunks. |
| `src/example-program-map.ts` | Building a condensed program map with the `ProgramMapper`. |
| `src/index.ts` | A small command dispatcher that ties all the above together. |

### Running it

To run the example project you'll need to clone the `langium-ai` repo, install, and build from the `./packages/examples/example-dsl-evaluator` example package.

```bash
git clone https://github.com/eclipse-langium/langium-ai.git
cd langium-ai/packages/examples/example-dsl-evaluator
npm install
npm run build
```

This example project drives **local** models through [Ollama](https://ollama.com/), so nothing here needs an API key unless your setup requires it.
You can switch to any other local or upstream hosting provider, and simply drop it in.

For Ollama, be sure to pull down these models for the demo at hand. Note these can easily be changed, but to ensure the demo works out of the box you'll need the following installed.

```bash
ollama pull codellama
ollama pull llama3.2
ollama pull codegemma
# embedding model, for the embedding evaluator
ollama pull mxbai-embed-large
```

Then, you can kick off the demo like so:

```bash
# run the LangDev suite and open the radar chart
npm run demo
# the same suite, without opening the chart
npm run start -- run-langdev
# regenerate a chart from the last saved results
npm run start -- report
# the splitter example
npm run start -- splitter
# the program map example
npm run start -- program-map

# and a bit of help along the way
npm run start -- help
```

Each run writes a timestamped JSON report to its history folder, so `report` can rebuild the chart without re-running any models.

::: warning Before you clone it expecting to run everything!
A couple things to keep in mind:

- **The RAG path needs more setup.** `run-langium` expects a **ChromaDB** instance on
  `localhost:8000`, an additional `llama3.1` model, and a pre-built embedding collection. The
  `run-langdev` suite has no such dependency, so you'll need to set that up in advance.
- **Model output is not reproducible.** Any numbers you get will differ from those shown in
  the repo. That's inherent to evaluating models, not a sign something is misconfigured.
:::

<!--
  TODO(blocked by upstream bug): two walkthroughs planned for this page are omitted.

  1. The splitter/program-map walkthrough (src/example-splitter.ts, src/example-program-map.ts):
     splitByNode/splitByNodeToAst/ProgramMapper all throw on the current published version —
     the internal parseDocument() hardcodes URI.parse('memory://document.langium'), whose empty
     path makes Langium's service registry reject the extension ''. See splitter.md for the full
     note. The files are still described in the table above (accurate as source to read), but no
     runnable walkthrough is reproduced here.

  2. The EvalMatrix walkthrough (src/eval-langdev.ts, src/eval-langium.ts): both put a
     LangiumEvaluator into the matrix, which currently throws because EvalMatrix passes
     testCase.expected_response as evaluate()'s fileExtension argument. See the note in
     evaluator.md. Once fixed, add the end-to-end matrix walkthrough here: runners ->
     cases -> merged evaluators -> run() -> averageAcrossRunners -> radar chart, adapted from
     eval-langdev.ts.

  TODO(upstream, docs-adjacent): the example project's README tells readers to "first build
  embeddings in the example-dsl-splitter project", but no such project exists under
  packages/examples/ (example-dsl-evaluator is the only one). Its printHelp() also advertises a
  'server' command that has no case in the switch. Worth fixing in the repo; until then this
  page deliberately doesn't repeat those instructions.
-->

## Related

- **[Splitter](/langium-ai-tools/splitter)** · **[Evaluator](/langium-ai-tools/evaluator)** ·
  **[Evals](/langium-ai-tools/evals)** · **[Analyzer](/langium-ai-tools/analyzer)**: the APIs used
  above, each on its own page.
- **[Quickstart](/quickstart)**: the CLI-driven path, which helps scaffold out the whole setup process for Langium AI.
