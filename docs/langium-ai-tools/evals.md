# Evals

`langium-ai-tools/evals` is a vitest-style API for writing evaluation files. If you've written
tests with vitest or jest, you already know the shape: `describe` groups, `evaluation` defines a
case, hooks handle setup and teardown, and `.skip` and `.only` can narrow what runs.

What's powerful about the `evals` API is that it supports writing _suites of evals_, with the same level of control you would expect when testing.
This is immensely helpful for managing, running, and reporting on your evaluations over time.

One key difference to note is what an evaluation case returns. A test will make an assertion, but an evaluation returns a score between 0
and 1, along with some metadata. In turn, there's no `expect`, because we're not passing/failing at the evaluation; we're recording assessment measures that we can use to compare and contrast with other runs.

In this sense, a standalone evaluation is not nearly as helpful as a history of evaluations. In that case, progress can be clearly measured and reasoned about.

<!-- These are the files `lai evaluate` discovers and runs. You can also drive them
[yourself](#running-evals-yourself). -->

::: tip Getting your first file
`lai init` scaffolds `evals/basic.eval.ts` for your language, pre-wired with your services and a
stubbed case that scores 1 without calling a model. The [Quickstart](/quickstart) walks through
it. This page is the reference for what you write next.
:::

## The shape of an eval file

For reference here are the imports:

```ts twoslash
import { describe, evaluation, beforeAll, afterAll, beforeEach, afterEach } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
```

And here's an example evaluation that leverages the `LangiumEvaluator` to check for diagnostics.

```ts twoslash
// @filename: utils.ts
export interface GenerateOptions { systemPrompt?: string; temperature?: number; maxTokens?: number; }
export async function generateResponse(prompt: string, options?: GenerateOptions): Promise<string> {
    return '';
}
export function extractCodeBlock(text: string): string | undefined {
    return undefined;
}
// @filename: eval.ts
//---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import { EmptyFileSystem } from 'langium';
import { createMiniLogoServices } from "langium-minilogo/module";
import { generateResponse } from './utils.js';

const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;
const evaluator = new LangiumEvaluator(services);

describe('Code generation', () => {
    evaluation('generates a valid program', async (ctx: EvalContext) => {
        const expectedResponse = '...';
        const response = await generateResponse('Write a minimal valid program.', {
            systemPrompt: ctx.systemPrompt
        });

        const result = await evaluator.evaluate(response, expectedResponse);

        // note this isn't pass fail, we're returning a score,
        // one which we decide here how we want to compute.
        // in this example it's a 1/0, but factoring in the rest of our diagnostics
        // and their counts typically produces a more varied score
        return { score: result.data.errors === 0 ? 1 : 0 };
    });
});
```

Files are plain TypeScript modules. Everything lies at the module scope: service construction, evaluator
setup, loading fixtures, etc.
This all runs once when the file is imported, so keep expensive one-time work there, or in a `beforeAll` hook.

## `EvalContext`

Every case receives a context object, which is straightforward:

```ts twoslash
interface EvalContext {
    systemPrompt: string;
    project: { name: string };
}
```

| Field | What it holds |
|---|---|
| `systemPrompt` | The contents of the current system prompt to apply. |
| `project.name` | The project name from your `lai` config, handy for labeling output. |

Because the prompt arrives through the context rather than being hardcoded in the file, you can
regenerate the prompt (`lai gen sysprompt`), re-run the same suite, and attribute the score change
to the prompt directly.

## What a case returns

```ts twoslash
type EvaluationData = {
    score: number;      // 0 = complete failure, 1 = full pass
    skipped?: boolean;
    error?: Error | string;
};
```

`score` is required and normalized to 0–1. The runner interprets it the same way the CLI's
reporting does: `>= 0.8` reads as green, `>= 0.5` as marginal, and below that as failing.

Partial credit is encouraged. A case that returns `errors === 0 ? 1 : 0` throws away information (which is exactly what we were doing before!).
A better example of a score could be one that scales with the number and type of diagnostics:

```ts twoslash
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import { evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const evaluator = new LangiumEvaluator(services);
declare function generateResponse(p: string, o?: { systemPrompt?: string; temperature?: number }): Promise<string>;
const expectedResponse: string = 'a program defining three entities';
// ---cut---
evaluation('mostly valid output', async (ctx: EvalContext) => {
    const response = await generateResponse('Write a program with three entities.', {
        systemPrompt: ctx.systemPrompt
    });
    const result = await evaluator.evaluate(response, expectedResponse);

    // 0 errors -> 1.0, and each error costs 20%
    const score = Math.max(0, 1 - result.data.errors * 0.2);

    return { score };
});
```

Of course there are _many_ ways to calculate a score here, and we don't want to suggest this approach is ideal (it doesn't even account for quantity of diagnostics, for example). We don't believe there's a singular best approach to prescribe here, so we would rather show you scores can be calculated, and let you decide what's best for your needs.

## Extra fields are preserved

The runner stores _whatever_ object you return as the case's `data`, so
additional properties (a similarity number, a marker like `stub: true`, an error count) end up in
the saved run and are visible in `lai history`.
Since `EvaluationData` only declares the three fields above, TypeScript's excess-property check may complain if you return extra properties in
an inline object literal.
In such a case, just assign to a variable first, or type the variable as `EvaluationData & { ... }`:

```ts twoslash
declare const score: number;
declare const result: { data: { errors: number } };
declare const similarity: number;
function evaluationCase() {
// ---cut---
const data = { score, errors: result.data.errors, similarity };
return data;
// ---cut-after---
}
```

:::tip
**Throwing is safe.** If a case throws, the runner will catch it and record `score: 0` with the
error message attached. It'll then carry on working with the rest of the file, so one broken case doesn't stop the rest of the suite.
:::

## Suites and cases

```ts twoslash
import { describe, evaluation } from 'langium-ai-tools/evals';
// ---cut---
describe('Suite name', () => {
    // in a nutshell,
    // produces an object containing at least a score
    evaluation('case name', async (ctx) => ({ score: 1 }));
});
```

`evaluation()` must be called inside a `describe()` callback. If you call it at the top level it'll throw, indicating that `evaluation() must be called inside describe()`.
Something worth keeping in mind: `describe` can be nested inside other `describe` blocks, but this produces a new suite rather than a parent-child relationship.

### `.skip` and `.only`

Like in most standard testing libraries, we've included common testing modifiers to `describe` and `evaluation` blocks.
These include `skip` and `only`, which allow you to skip a block, or _only_ run a block while mutually excluding every other block that isn't marked with `only`.

```ts twoslash
import { describe, evaluation } from 'langium-ai-tools/evals';
// ---cut---
// skip everything in describe
describe.skip('Skipped describe', () => { /* every case here is skipped */ });

describe.only('Only run this one!', () => {
    evaluation('a', async () => ({ score: 1 }));
});

describe('Mixed', () => {
    evaluation.skip('something we want to skip for now', async () => ({ score: 1 }));
    evaluation.only('run just this one', async () => ({ score: 1 }));
    evaluation.only('and this one too', async () => ({ score: 1 }));
});
```

Keep in mind that `.only` is resolved across the whole file, not just per suite.
If any describe suite or any case in the file is marked `.only`, everything not covered by a `.only` is implicitly skipped.
The only exception is if another suite or case has `.only` or contains an `.only` case.

Skipped cases still appear in results, recorded as `{ score: 0, skipped: true }`.
They're visible as skipped rather than vanishing, so that information is preserved later on.

## Lifecycle hooks

Similar to the suite and case modifiers, there are also standard evaluation lifecycle hooks.
Chiefly, `beforeAll`, `beforeEach`, `afterAll`, and `afterEach`.
These are commonly used for setup and teardown at different levels of granularity.

```ts twoslash
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { describe, evaluation, beforeAll, beforeEach, afterEach, afterAll } from 'langium-ai-tools/evals';
const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
declare function warmUpModel(): Promise<void>;
declare function clearCache(): void;
declare function releaseModel(): void;
// ---cut---
describe('DSL generation', () => {
    beforeAll(async () => {
        await warmUpModel();
    });

    beforeEach(async () => {
        // common for langium projects,
        // especially those with built-in libraries
        // see: https://langium.org/docs/recipes/builtin-library/
        await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
    });

    afterEach(() => clearCache());
    afterAll(() => releaseModel());

    evaluation('...', async (ctx) => ({ score: 1 }));
});
```

| Hook | Runs |
|---|---|
| `beforeAll` | Once, before the suite's first case. |
| `afterAll` | Once, after the suite's last case. |
| `beforeEach` | Before every case in the suite. |
| `afterEach` | After every case in the suite. |

All four are defined at the suite level, and must be registered inside `describe()`.
They're also async, and you should only have one of each.

:::tip
If you do have more than one hook (such as a pair of `beforeAll` hooks declared) only the last one takes effect.
Make sure you only have one of each to avoid this.
:::

Failure behavior also differs by hook, which is worth knowing before you put anything load-bearing in
one:

- Throwing in **`beforeAll`/`afterAll`** is logged and the suite continues. A setup that silently
  fails in this way will show up with every case scoring 0, so you should log this visibly in your own hook if it matters.
- Throwing in **`beforeEach`** will auto-fail that case (`score: 0` plus the error) and move on.
- `afterAll`/`afterEach` will simply log if an exception is thrown.

Lastly, if a suite or evaluation is skipped, its hooks won't fire either.

## Parametrized evaluations

Sometimes you need to produce a lot of evaluations using some data source (like a JSON or CSV file full of evals).
You can plumb these into your evaluations using a standard `evaluation.each` which takes an array of cases and returns the definition function:

```ts twoslash
import { evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
declare function parse(s: string): { name: string };
// ---cut---
evaluation.each([
    { input: 'person Alice', expected: 'Alice' },
    { input: 'person Bob', expected: 'Bob' }
])('extracts name $expected', (data) => async (ctx: EvalContext) => {
    const parsed = parse(data.input);
    return { score: parsed.name === data.expected ? 1 : 0 };
});
```

Note the double arrow, the second argument receives data and returns the evaluation function that we should run.
That gives each generated case its own closure.

Names are interpolated so each case is identifiable in reports using the following:

| Placeholder | Substitutes |
|---|---|
| `$property` | The named property of the row (objects only) — `$expected` -> `Alice`. |
| `%s`, `%i` | The row, stringified. |
| `%o`, `%j` | The row as JSON. |

If a name contains no placeholder at all, the row index is appended (`extracts name [0]`,
`extracts name [1]`) so cases will remain uniquely named.

## Using an evaluator in a case

Using the existing [Evaluators](/langium-ai-tools/evaluator), like the [`LangiumEvaluator`](/langium-ai-tools/evaluator#langiumEvaluator), works quite well in the evals API.
Previously we showed how these were invoked programmatically, but naturally they're well suited to use in evaluation cases too.

```ts twoslash
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import { evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
declare const langiumEvaluator: LangiumEvaluator<any>;
declare function generateResponse(p: string, o?: { systemPrompt?: string; temperature?: number }): Promise<string>;
const expectedResponse: string = 'entity Person definition';
// ---cut---
evaluation('generates a valid entity', async (ctx: EvalContext) => {
    const response = await generateResponse('Define an entity called Person.', {
        systemPrompt: ctx.systemPrompt
    });

    const result = await langiumEvaluator.evaluate(response, expectedResponse);
    const mentionsEntity = /entity\s+Person/.test(response);

    const data = {
        score: result.data.errors === 0 && mentionsEntity ? 1 : 0,
        errors: result.data.errors,
        warnings: result.data.warnings
    };
    return data;
});
```

`langiumEvaluator.evaluate()` already makes an attempt to recognize and handle fenced code blocks, so you can often pass the raw response as-is.

This is just one example of course, so if you haven't covered it already, go read up on the Evaluator documentation noted above so you can see how they work, and how you can customize them.

## Provider calls are user defined

Nothing in this API talks to a model.
The scaffolded `evals/utils.ts` provides a `generateResponse()` stub that throws until you implement it, with commented examples for OpenAI, Anthropic, and Ollama.
That's where your provider goes, and it stays your code so the eval API is independent of your provider and its stack.

Keeping the provider call in one shared helper also means switching models later is a one-file change.

## Running evals yourself

`lai evaluate` is the usual driver via the [cli](/langium-ai/), but the runner is also programmatically accessible as a raw export.
This means you can invoke it yourself, directly:

```ts twoslash
declare const systemPrompt: string;
// ---cut---
import { runEvalFile } from 'langium-ai-tools/evals';

const results = await runEvalFile(
    './evals/basic.eval.ts',
    { systemPrompt, project: { name: 'my-dsl' } },
    (completed, total) => console.log(`${completed}/${total}`),
    (result) => console.log(result.name, result.data.score)
);
```

`runEvalFile(filePath, context, onProgress?, onResult?)` imports the file, executes all registered suites, and resolves to one result per case — including skipped ones.
For `.ts` files it attempts to register the `tsx/esm` loader on first use.

Each result carries `metadata` props: `evalFile`, `suiteName`, `caseName`, and `duration`. This is alongside your returned `data`, which is used to support per-case reporting.

Going into further detail, there are two lower-level exports behind this. `getCollectedSuites()` returns the suites registered so far and
drains the registry as it does (so a second call doesn't return anything). `clearSuites()` resets
it. Generally you want to call `clearSuites()` before importing a file if you're running several in one process.

::: details Why the CLI sees suites your file registered
Registration goes through a global keyed by `Symbol.for('langium-ai-tools:evals')`.
Your eval file imports `langium-ai-tools/evals` from your project's own `node_modules`, while `lai` ships with its own bundled copy.
These are technically different module instances (even if they're version matched), but they share the same global registry.
This lets the CLI collect cases from a locally installed library.
:::

## Related

- **[Evaluator](/langium-ai-tools/evaluator)**: `LangiumEvaluator` and the evaluator API (not the `evals` API here, which is generally intended for cli use).
- **[Quickstart](/quickstart)**: from install to a passing run, including the scaffolded eval file.
- **[`lai` CLI](/langium-ai/usage)**: running, listing, and comparing evaluation runs.

<!--
  TODO(verify against published CLI): the scaffolded template is documented on the Quickstart
  rather than reproduced here. The template text ships embedded in the published lai bundle
  (dist/lai.js, minified) and could not be extracted verbatim for this pass; the copy in the
  repo at packages/cli/templates/basic.eval.ts is STALE relative to published behaviour — it
  imports from 'langium-ai-tools/testing' (a specifier that no longer exists; it's /evals now)
  and returns `{ passed, ... }` instead of a `score`. Before reproducing any template snippet
  on this page, re-derive it from the published CLI (e.g. run `lai init` in a temp project)
  rather than from the repo file.
-->
