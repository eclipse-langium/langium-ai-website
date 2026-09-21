# Evaluator

An evaluator turns a model's output into metrics.
The `LangiumEvaluator` does this by running LLM output through your language, parsing it, validating it, and performing measurements on the results as a whole.
This result is then computed into a grade, or score, that is used as a means of evaluating the quality of the model's output.

This page covers the evaluator objects and the evaluation matrix built on them. For the
vitest-style API you use to write `.eval.ts` files, see [Evals](/langium-ai-tools/evals).

::: info
As a note, an evaluator *grades* outputs that are used to assess quality.
It's important to point out that this isn't testing in the pass/fail sense.

Although it _is technically_ testing, not all tests fall into this category.

This is tricky since, inherently, these checks are not quantitative, but we can reason about their quantities.
For example, one parser error is a red flag, but what about a warning from some diagnostic?
In the same sense, what about 50 warnings and one parser error? Do you account for ease of correction on errors, or whether multiple warnings signal to something greater that's afoot?

It really depends circumstantially, and so although this is a powerful way to assess your model's capabilities, it's not the only way to assess a model's capabilities in a standalone sense.
It's always good to have the means to verify your model's performance in more than one way.
:::

## `LangiumEvaluator`

There are several exports you can leverage up front.
These are the default `Evaluator`, the `LangiumEvaluator`, and a helper `mergeEvaluators` to sequence evaluators.
The base `Evaluator` is extended to produce your own custom evaluators.
The `LangiumEvaluator` provides some prebuilt handling to perform validations, and return diagnostics of note.

And here are the imports for reference:

```ts twoslash
import { Evaluator, LangiumEvaluator, mergeEvaluators } from 'langium-ai-tools/evaluator';
```

To test this out, construct an evaluator using your language's services and hand it a string:

```ts twoslash
const grammar = "...";
const modelOutput: string = 'grammar Sample';
const expectedOutput: string = 'grammar Sample';
//---cut---
import { EmptyFileSystem } from 'langium';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
// change for your own language
import { createMiniLogoServices } from "langium-minilogo/module";
import { LangiumDocumentAnalyzer } from "langium-ai-tools/analyzer";
const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;

const evaluator = new LangiumEvaluator(services);

const result = await evaluator.evaluate(modelOutput, expectedOutput);

console.log(result.data.errors, result.data.warnings);
```

`evaluate` is **async**, so make sure to `await` it! Additionally, `EmptyFileSystem` is the right choice when you're
grading a string in memory, not opening files. You can also use the `NodeFileSystem` as well if you're doing checks on a workspace at large.

### What's in a grade?

`LangiumEvaluator` measures whether the output is a *valid program in your language*. It parses
the text, builds the document with validation enabled, and counts the diagnostics your own
validators produce. It does **not** explicitly compare the output to an expected answer; instead, it gives you insight into the quantity of diagnostics emitted.

If you want similarity, that's better handled by a [custom evaluator](#custom-evaluators).

That distinction is the reason this evaluator is a good default: it's the one metric that correlates directly with your LSP diagnostics.
These are already used, to great effect, to evaluate and guide an LLM's code generation attempts.
In this case, you get a chance to view correctness without giving the model access to those same diagnostics.

### Result shape

```ts twoslash
type EvaluatorResult<T> = {
    name: string;      // the evaluator's class name
    metadata: { duration: number } & Record<string, unknown>;
    data: T;
};
```

It's worth noting that `T` for the `LangiumEvaluator` is bound to `LangiumEvaluatorResultData`.

As for the metrics that we get back, the numbers live in `result.data`:

| Field | Meaning |
|---|---|
| `errors` | Diagnostics with severity 1. Anything greater than 0 means the output isn't syntactically or semantically valid. |
| `warnings` | Severity 2. |
| `infos` | Severity 3. |
| `hints` | Severity 4. |
| `unassigned` | Diagnostics that carried no severity. |
| `failures` | `1` when the document couldn't be built at all (an exception during parse/build), otherwise `0`. This is a fallback for outright failures that potentially crashed or experienced undefined behavior. |
| `diagnostics` | The raw `Diagnostic[]`, so you can inspect messages and ranges rather than just counts. |

Reading the diagnostics directly is often the most useful part when you're iterating on a system
prompt, as it tells you which rules were broken.

```ts twoslash
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const evaluator = new LangiumEvaluator(services);
const modelOutput: string = 'grammar Sample';
const expectedResponse: string = 'a valid grammar program';
const result = await evaluator.evaluate(modelOutput, expectedResponse);
// ---cut---
for (const d of result.data.diagnostics) {
    console.log(`${d.severity}: ${d.message}`);
}
// error: Could not resolve reference to AbstractRule named 'MISSING'.
```

:::tip
It's often the case that effective DSL stacks for an AI feed back LSP diagnostics to support self-correction.
This can save on initial context, rather than trying to account for every possible error case that needs to be avoided in a one-shot response.
:::

<!--
  TODO(blocked by upstream bug): the LangiumEvaluatorResultData field `responseLength` is
  deliberately left out of the table above. createEmptyResultData() initializes it to 0, but
  evaluateDocument() then writes the real character count to `response_length` (snake_case),
  which is not a declared field. So the documented property is always 0 and the populated one
  is untyped. Verified on 5.0.6. Once the field names are reconciled upstream, document the
  survivor here (response length is genuinely useful for spotting runaway generations).

  TODO(blocked by upstream bug): metadata.duration is hardcoded to 0 in
  LangiumEvaluator.evaluateDocument (see the "no duration available" comment), so timing is
  not reported for a standalone evaluate() call. Document it once it's populated. (Inside an
  EvalMatrix, metadata.duration is the *runner's* duration, written by the matrix — that part
  is real and is documented below.)
-->

### Code blocks are extracted automatically

If the input contains a fenced code block, `evaluate` grades **the first fenced block** rather
than the whole string. Models frequently wrap generated code in prose and fences (or can be nudged to), so this saves
a processing step:

````ts twoslash
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const evaluator = new LangiumEvaluator(services);
const expectedResponse: string = 'a valid entity definition';
// ---cut---
// both of these grade the same program
await evaluator.evaluate('entity Person { name: string }', expectedResponse);
await evaluator.evaluate('Sure! Here you go:\n```mydsl\nentity Person { name: string }\n```', expectedResponse);
````

Two consequences worth knowing: the fence language tag is ignored, and if a response contains
several blocks only the first is looked at.

### For when you have more than one language

```ts twoslash
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const evaluator = new LangiumEvaluator(services);
const input: string = 'a sample program';
// ---cut---
await evaluator.evaluate(input, 'mydsl');
```

The second parameter is a **file extension**, but it won't come up very often. It's used to help build the
in-memory document's URI with the correct extension, so Langium picks the right language services to parse with.
Pass it when your services host several languages and you need to set one explicitly, otherwise it'll default to your language's first extension defined in `LanguageMetaData`.

### Trying it without your own DSL

Every Langium install ships a real Langium language: the grammar language itself. It's helpful for
experimenting with evaluators before you set up your own services, and it's what the repo's own
[example project](/langium-ai-tools/examples) uses.

```ts twoslash
const expectedResponse: string = 'a valid grammar program';
// ---cut---
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const evaluator = new LangiumEvaluator(services);

const result = await evaluator.evaluate(`
  grammar Broken
  entry Greeting: 'hello' name=MISSING;
`, expectedResponse);

// result.data.errors === 1
// result.data.diagnostics[0].message ===
//   "Could not resolve reference to AbstractRule named 'MISSING'."
```

## Custom evaluators

For cases where the regular `LangiumEvaluator` isn't sufficient on its own, or you need an entirely different evaluation approach, go for a custom evaluator.
Extend `Evaluator` and return whatever data fields you like:

```ts twoslash
/**
 * Compute the edit distance between two strings
 */
function levenshtein(a: string, b: string): number { return 0}
//---cut---
import { Evaluator, type EvaluatorResultData, type EvaluatorResult } from 'langium-ai-tools/evaluator';

// customized evaluator payload data
export interface EditDistanceData extends EvaluatorResultData {
  edit_distance: number
}

export class EditDistanceEvaluator extends Evaluator {
    async evaluate(response: string, expected_response: string): Promise<EvaluatorResult<EditDistanceData>> {
        return {
          name: "edit-distance-evaluator",
          metadata: {
            // adjust to however long this took to run,
            // or zero if negligible
            duration: 0
          },
          data: {
            edit_distance: levenshtein(response.trim(), expected_response.trim())
          }
        };
    }
}
```

The abstract `Evaluator` requires you to implement `evaluate` with two arguments (`response`, `expected_response`) and a plain data object is returned.
`EvaluatorResultData` is effectively `Record<string, unknown>`, so your metric names are yours, and they can be passed straight through to reports and to the averaging helpers, which aggregate every numeric field they find.

Some common patterns for custom evaluators include: string similarity, presence of specific AST node types or structure, phrase detection, LLM as a judge, or checking against the embedding distance of a reference answer.

### `mergeEvaluators`

```ts twoslash
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator, mergeEvaluators, Evaluator, type EvaluatorResult } from 'langium-ai-tools/evaluator';
const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
declare class EditDistanceEvaluator extends Evaluator {
    evaluate(response: string, expected_response: string): Promise<EvaluatorResult>;
}
// ---cut---
const combined = mergeEvaluators(new LangiumEvaluator(services), new EditDistanceEvaluator());
```

Runs each evaluator in sequence on the same input and shallow-merges their results into one
object. Later evaluators win on key collisions, which is important to keep in mind. So be sure your metrics have distinct names if that's the case.

## Evaluation matrix

```ts twoslash
import { EvalMatrix } from 'langium-ai-tools/evaluator';
```

A single evaluator grades one output. An `EvalMatrix` runs the cross product: every runner
against every case, scored by every evaluator, and repeated `num_runs` times, with the results
aggregated and written to disk.

This is a helpful tool for answering questions about comparative performance between models, their stacks, and the tasks at hand.

### Runners

A runner is anything that turns a prompt into text. Really, anything:

```ts twoslash
import { type Message as MessageType } from 'langium-ai-tools/evaluator';
declare const myModel: { generate(p: string, m: MessageType[]): Promise<string>; };
// ---cut---
import { type Runner, type Message } from 'langium-ai-tools/evaluator';

const myRunner: Runner = {
    name: 'my-model',
    runner: async (prompt: string, messages: Message[]) => {
        const response = await myModel.generate(prompt, messages);
        return response;
    }
};
```

`Message` is `{ role: 'user' | 'system' | 'assistant', content: string }`, which is the lowest common
denominator across all providers (local or otherwise).

Because the interface is quite thin, a runner can wrap a direct model call, a RAG pipeline with a
vector lookup in front of it, a multi-step agent, or a canned response for a sanity check.

:::tip
Runner names do have to be unique, otherwise `run()` rejects duplicates up front rather than producing an ambiguous report.
:::

### Cases

Short for an evaluation case. These are the input-output pairs that are assessed. At the core they have a prompt going in, and some expected response coming out.

```ts twoslash
import { type EvalCase } from 'langium-ai-tools/evaluator';

const testCase: EvalCase = {
    name: 'hello-world-grammar',
    prompt: 'Generate a Langium grammar for a simple hello world DSL',
    expected_response: `grammar HelloWorld
entry Greeting: 'hello' name=ID;
terminal ID: /[_a-zA-Z][\\w_]*/;`,
    // optional
    history: [{ role: 'system', content: 'You are an expert in Langium grammars.' }],
    tags: ['grammar', 'beginner']
};
```

Note that although there's an expected_response, an evaluator does not need to honor it. It may very well be an evaluator that's interested in other aspects of the output, rather than how well it adhered to an expected answer.

| Field | Required | Meaning |
|---|---|---|
| `name` | ✓ | Identifies the case in results and reports. |
| `prompt` | ✓ | The input handed to each runner. |
| `expected_response` | ✓ | The reference answer, passed to evaluators as their second argument. |
| `history` | | Prior messages (system/user/assistant) prepended for this case. |
| `tags` | | Free-form labels for your own filtering and grouping. |

<!--
  TODO(blocked by upstream bug): EvalCase.only_check_codeblocks is intentionally undocumented.
  loadFromYaml validates and carries the field, but nothing in the package ever reads it —
  no reference in eval-matrix, evaluator, document-evaluator, or the analyzer (grepped
  across dist/ in 5.0.6). Meanwhile AbstractDocumentEvaluator.evaluate() extracts the first
  fenced block *unconditionally*, so document evaluators behave as if it were always on and
  the flag has no effect either way. Document it once it's actually wired up (or drop it).
-->

Cases can also live in YAML, which can be easier to maintain once you have more than a few:

```yaml
# eval-cases.yaml
eval_cases:
  - name: "hello-world-grammar"
    prompt: "Generate a Langium grammar for a simple hello world DSL"
    expected_response: |
      grammar HelloWorld
      entry Greeting: 'hello' name=ID;
      terminal ID: /[_a-zA-Z][\w_]*/;
    tags:
      - "grammar"
      - "beginner"
```

```ts twoslash
/// <reference types="node" />
// ---cut---
import { loadFromYaml } from 'langium-ai-tools/evaluator';
import { readFileSync } from 'node:fs';

const cases = loadFromYaml(readFileSync('eval-cases.yaml', 'utf-8'));
```

`loadFromYaml` takes the YAML *string*, not a path. It accepts either a top-level `eval_cases:`
list or a single case object, and validates as it goes.
If there's a missing `prompt` or a non-boolean flag, it'll throw with the offending field name.

### Running the matrix

Once you have your evaluators, your runners, and your cases, you can proceed with running an `EvalMatrix`.
The process is pretty simple, just pass each of the above items in, and supply some base configuration.

```ts twoslash
import { type Runner, type EvalCase, Evaluator, type EvaluatorResult } from 'langium-ai-tools/evaluator';
declare const baseRunner: Runner;
declare const ragRunner: Runner;
declare const cases: EvalCase[];
declare class EditDistanceEvaluator extends Evaluator {
    evaluate(response: string, expected_response: string): Promise<EvaluatorResult>;
}
// ---cut---
import { EvalMatrix, LangiumEvaluator } from 'langium-ai-tools/evaluator';

const matrix = new EvalMatrix({
    config: {
        name: 'Model Comparison',
        description: 'Comparing models for DSL generation',
        history_folder: '.eval-history',
        num_runs: 3
    },
    runners: [baseRunner, ragRunner],
    evaluators: [
        { name: 'Edit Distance', eval: new EditDistanceEvaluator() }
    ],
    cases
});

const results = await matrix.run();
```

| Config field | Meaning |
|---|---|
| `name` | Descriptive name; also used in the report filename. |
| `description` | Longer description, stored in the report. |
| `history_folder` | Directory for timestamped JSON reports. Created if missing. |
| `num_runs` | How many times to run each runner & case combination, results are averaged later. |

Evaluators are supplied as `{ name, eval }` pairs — the name is what shows up in results, so it
can be more descriptive than the class name itself.

`run()` logs its progress (runner, case, evaluator, run number) as it goes, then writes the
report and returns a flat result list.
<!-- 
::: warning A Langium evaluator can't go straight into a matrix yet
`LangiumEvaluator` and [`LangiumDocumentAnalyzer`](/langium-ai-tools/analyzer) can't currently be
used as matrix evaluators — see the note below. Custom evaluators that implement the two-argument
contract work as documented.
::: -->

<!--
  TODO(blocked by upstream bug): the "put a LangiumEvaluator in the matrix" example — which is
  the headline example in packages/langium-ai-tools/README.md and in
  packages/examples/example-dsl-evaluator/src/eval-langdev.ts — is omitted, along with the
  README's "Complete Example", because it throws.

  Cause: EvalMatrix.run() calls `evaluator.eval.evaluate(response, testCase.expected_response)`,
  but AbstractDocumentEvaluator overrides evaluate(input, fileExtension?) — the second
  parameter is a FILE EXTENSION, not an expected response. The case's expected_response is
  therefore spliced into the document URI (`memory:/test.${fileExt}`), the extension resolves
  to '', and Langium's service registry throws:

      Error: The service registry contains no services for the extension ''.

  The call is not wrapped in try/catch, so it aborts the whole run on the first case.
  Verified end-to-end on langium-ai-tools@5.0.6 (langium 4.2.x).

  Second, independent mismatch at the same seam: the abstract base declares
  evaluate(): Promise<EvaluatorResultData> (a bare data bag), while AbstractDocumentEvaluator
  returns Promise<EvaluatorResult<RD>> (name + metadata + data). Even with the extension bug
  fixed, the matrix would store the whole result object as the case's `data`, giving
  data.data.errors instead of data.errors.

  Once both are fixed upstream, add here:
    - a matrix using `{ name: 'Langium Parser + Validation', eval: new LangiumEvaluator(services) }`
    - the mergeEvaluators(langiumEval, customEval) matrix example
    - the full end-to-end example (runners + cases + evaluators + averaging + console.table)
    - the analyzer-as-drop-in-evaluator example (cross-link analyzer.md, which has the
      matching TODO)
-->

### Results

The eval matrix returns an array of results, where each result has an associated runner, case, evaluator, and iteration:

```json
{
  "name": "stub-runner - hello-grammar - Length Ratio",
  "metadata": {
    "runner": "stub-runner",
    "evaluator": "Length Ratio",
    "testCase": { "name": "hello-grammar", "prompt": "…", "expected_response": "…" },
    "actual_response": "grammar Hello\nentry Greeting: 'hello' name=ID;",
    "duration": 0.412,
    "run_count": 1
  },
  "data": { "length_ratio": 0.7 }
}
```

`metadata.duration` is the **runner's** time in seconds (how long generation took), `run_count` is the 1-based iteration, and `actual_response` is the full text that was evaluated.
The latter is helpful when a score looks potentially wrong, and you need to see what the model actually responded with.

Every run also writes `<timestamp>-<name>.json` into the specified `history_folder`.
Each run contains the config, the date, the total runtime, and all results, plus a `last.txt` naming the most recent report.

### Aggregating

Naturally, when you have the ability to perform more than one iteration on the same runner-case-evaluator product, you'll also want a way to aggregate across them.

```ts twoslash
import { EvalMatrix } from 'langium-ai-tools/evaluator';
declare const matrix: EvalMatrix;
const results = await matrix.run();
// ---cut---
import {
    averageAcrossCases,
    averageAcrossRunners,
    loadReport,
    loadLastResults
} from 'langium-ai-tools/evaluator';

// average the num_runs iterations of each runner-case-evaluator combination
const perCase = averageAcrossCases(results);

// collapse further, to one row per runner
const perRunner = averageAcrossRunners(results);

console.table(perRunner.map((r) => ({ name: r.name, ...r.data })));
```

Both helpers average every **numeric** field they find and drop the non-numeric ones.
The results are rounded to two decimals as well.

`averageAcrossCases` groups by the combined runner–case–evaluator name, and `averageAcrossRunners` reduces to one row per runner — the table you actually want when comparing candidates.

### Loading prior runs

Reading past runs can be done with `loadReport` and `loadLastResults`:

```ts twoslash
import { loadReport, loadLastResults } from 'langium-ai-tools/evaluator';
// ---cut---
const report = loadReport('.eval-history/2026-01-01T00-00-00-000Z-model-comparison.json');
const lastThree = loadLastResults('.eval-history', 3);
```

`loadLastResults(dir, take)` sorts the directory's report filenames newest-first and returns the
results from the `take` most recent. Note that `take` counts *reports*, not individual results.

<!--
  TODO(blocked by upstream bug): two rough edges here are deliberately not documented as
  usable behavior.

  1. loadLastResults(dir) with `take` omitted reads every *.json in the directory AND then
     appends the filename from last.txt again — so the most recent report's results are
     counted twice (verified: a folder with one 2-result report returned 4 entries). Docs
     therefore only show the `take` form. Restore the no-arg form once it's fixed.

  2. averageAcrossCases/averageAcrossRunners mutate their input: avgData is a reference to
     groupedResults[0].data, so summing writes into the original result objects and
     non-numeric fields are deleted from them. Calling both helpers on the same array, or
     inspecting `results` after averaging, gives corrupted data. Once they copy instead,
     document that the input is left intact (and that chaining is safe).
-->

## Related

- **[Evals](/langium-ai-tools/evals)**: the `describe`/`evaluation` API for `.eval.ts` files,
  which is where an evaluator usually gets used.
- **[Analyzer](/langium-ai-tools/analyzer)**: a `LangiumEvaluator` subclass that adds grammar
  coverage and diversity statistics.
- **[Examples](/langium-ai-tools/examples)**: the example project's custom evaluators (edit
  distance, embedding similarity) and Ollama runners.
