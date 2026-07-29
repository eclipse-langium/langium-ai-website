# Examples

The following are task-oriented walkthroughs for the `lai` CLI, centered on the evaluation workflow.
This page shows you how to string commands together to accomplish tasks, and most importantly, go from stubbed
placeholders to real evaluations backed by a provider of your choice.

If you need to double check what these commands are, check out the [command reference](/langium-ai/usage).

::: tip Prerequisite
This picks up where the [Quickstart](/quickstart) leaves off.
You should have `lai` installed, `lai init` run, and a descriptor + system prompt generated.
If you haven't done that yet, start there.
:::

## End-to-end evaluation workflow

Assuming you have a fresh project, the following is an example of using `lai` to set everything up, evaluate, and compare some runs.

First, you'll need to do a one-time setup for your project:
```bash
lai init
```

Then, you'll want to map out your project into a descriptor:
```bash
lai gen descriptor
```

Once you have a descriptor, you can generate an initial system prompt that can be used to start evaluating.
```bash
lai gen sysprompt
```

At this point, you should wire up your own LLM provider(s) in evals/utils.ts (see below).
Once you've done that, you can perform your first evaluation run!
```bash
lai evaluate
```

After the run, you can review your results.
```bash
lai show latest
```

Now, you can decide if you want to update your descriptor in case it missed anything, and your system prompt as well.
For your system prompt, it's fairly common to make custom changes and improvements (the generated one is rarely adequate as-is).
From there, you can regenerate your system prompt (if you changed your descriptor appreciably), and evaluate once more.
```bash
# only if you updated your descriptor
lai gen sysprompt --fresh

lai evaluate
```

We have two recorded runs now, so we can compare them to see how they fared relative to each other:
```bash
lai compare 1 2
```

With all of these steps, you've essentially captured the kernel that is evaluating with Langium AI.
The simplicity of the setup allows you to expand on your evals as you see fit, while connecting your DSL services with your AI stack.

## Connecting a provider

Langium AI is provider-agnostic by design — it doesn't pick your model.
`lai init` scaffolds `evals/utils.ts` with a `generateResponse()` function that throws until you implement it, plus some commented examples for a few providers.
You'll need to set up your own provider logic or bring in an SDK; as long as you keep the `generateResponse` signature, your eval cases don't need to worry about its internal details.
You can also add other functions to try out different approaches and setups, the initial one is just a seed to help get things going.

For reference, the scaffolded stub looks like this:
```ts twoslash
export interface GenerateOptions {
    systemPrompt?: string;   // your generated DSL system prompt
    temperature?: number;    // 0 = lower variance, 1 = higher variance (default 0.7)
    maxTokens?: number;      // max response tokens (default 2048)
}

export async function generateResponse(
    prompt: string,
    options: GenerateOptions = {}
): Promise<string> {
    // replace this with a real provider implementation
    throw new Error('generateResponse() is not implemented yet.');
}
```

Pick a provider, install its SDK, set the relevant API key as an environment variable, and replace the body.

A note on the API key: it goes without saying, but do be _careful how you manage your API keys_.
Libraries like [dotenvx](https://www.npmjs.com/package/@dotenvx/dotenvx) are useful to secure your keys at rest.

::: tip Keep the signature, but change the body
Everything below returns a `Promise<string>` and reads `options.systemPrompt`.
It's a simple contract your eval cases can rely on.
The examples reflect each SDK's current shape, but treat them more as a recommendation on how you could set these up.
:::

### Anthropic

General recommendation on how you can set up Anthropic as a provider.

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY=sk-...
```

```ts twoslash
import Anthropic from '@anthropic-ai/sdk';

export interface GenerateOptions { systemPrompt?: string; temperature?: number; maxTokens?: number; }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateResponse(
    prompt: string,
    options: GenerateOptions = {}
): Promise<string> {
    const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        system: options.systemPrompt || '',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

### OpenAI

General recommendation on how you can set up OpenAI as a provider.

```bash
npm install openai
export OPENAI_API_KEY=sk-...
```

```ts twoslash
/// <reference types="node" />
// ---cut---
import OpenAI from 'openai';

export interface GenerateOptions { systemPrompt?: string; temperature?: number; maxTokens?: number; }

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateResponse(
    prompt: string,
    options: GenerateOptions = {}
): Promise<string> {
    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: options.systemPrompt || '' },
            { role: 'user', content: prompt }
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048
    });
    return response.choices[0].message.content || '';
}
```

### Ollama (local)

General recommendation on how you can set up Ollama as a provider.
Assumes you don't need an API key.
If you do need one, provide it as you would usually for other SDKs.

```bash
npm install ollama
```

```ts twoslash
import ollama from 'ollama';

const MODEL = 'gpt-oss:20b';

export interface GenerateOptions { systemPrompt?: string; temperature?: number; maxTokens?: number; }

export async function generateResponse(
    prompt: string,
    options: GenerateOptions = {}
): Promise<string> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await ollama.chat({
        model: MODEL,
        messages,
        options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048
        }
    });
    return response.message.content || '';
}
```

Once `generateResponse()` returns real text from any provider mentioned above or otherwise, `lai evaluate` will start evaluating actual LLM responses.

## Writing your first real evaluation

The scaffolded `evals/basic.eval.ts` returns a fixed stub score from every case.
This is partly a sanity check to ensure that it's easy to verify services are importable, and everything type checks, builds, and runs okay.
Once that's established, these stubs need to be replaced, and now's the perfect time to do so.

The more accurate implementations sit just below each `return`, commented out.
A generation evaluation follows the same five steps: prompt the model, extract the code, validate it with your language, score the result, and return the score.

The following is an example:
```ts twoslash
// @filename: utils.ts
export interface GenerateOptions { systemPrompt?: string; temperature?: number; maxTokens?: number; }
export async function generateResponse(prompt: string, options?: GenerateOptions): Promise<string> {
    return '';
}
export function extractCodeBlock(text: string): string | undefined {
    return undefined;
}
// @filename: basic.eval.ts
// ---cut---
import { describe, evaluation, beforeEach } from 'langium-ai-tools/evals';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import type { EvalContext } from 'langium-ai-tools/evals';
import { EmptyFileSystem } from 'langium';
// should be your DSL services name + the correct import
import { createMiniLogoServices } from "langium-minilogo/module";
import { generateResponse, extractCodeBlock } from './utils.js';

const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;
const evaluator = new LangiumEvaluator(services);

describe('Basic Code Generation', () => {
    beforeEach(async () => {
        await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
    });

    evaluation('should generate a valid program', async (ctx: EvalContext) => {
        // prompt the model, ctx.systemPrompt is either the default in your config,
        // or one you explicitly provide when evaluating with `--sysprompt <path>`
        const response = await generateResponse('create a simple program', {
            systemPrompt: ctx.systemPrompt,
            temperature: 0.7
        });

        // pull the code out of any markdown fences the model added
        const code = extractCodeBlock(response) || response;

        // run it through your parser and validator
        // the langium evaluator handles this for you
        // (second arg is the expected response, unused for validity-only scoring)
        const result = await evaluator.evaluate(code, '');

        // score it: for example valid + no diagnostics = 1, otherwise 0
        const isValid =
            !result.data.failures &&
            !result.data.errors &&
            !result.data.diagnostics.length;
        const score = isValid ? 1 : 0;

        // return the score plus any payload data you want recorded from the run
        return { score, ...result.data };
    });
});
```

`extractCodeBlock` (from the scaffolded `utils.ts`) strips markdown fences, and the scaffold also ships a `calculateSimilarity` helper for expected-output comparisons.
Both of these are simple helpers meant to get you going quickly.
As you expand your evaluations, you'll likely want to replace them (or modify them) with utility functions that are better suited to your exact needs.

::: tip The full evals API
`describe`, `evaluation`, `evaluation.each`, `.skip` / `.only`, and the lifecycle hooks are
documented on the library's [evals API page](/langium-ai-tools/evals). The
[evaluator](/langium-ai-tools/evaluator) page covers `LangiumEvaluator` and the result shape in
depth.
:::

## Comparing prompt strategies

Because `--sysprompt` overrides the configured prompt per run, A/B-testing two prompts is as simple as running two evaluations followed by a compare:

```bash
# run the same suite against two candidate prompts
lai evaluate --sysprompt ./prompts/v1.txt --output results-v1.json
lai evaluate --sysprompt ./prompts/v2.txt --output results-v2.json

# compare the two saved runs
lai compare results-v1.json results-v2.json
```

`lai compare` reports the change in average score, duration, and total time, plus the delta on the individual cases.
With this information, you can tell whether a prompt change actually helped based on your evaluation results.

## Inspecting and tracking results

Every run is persisted under `.langium-ai/`, so you can review and organize them after the fact:

```bash
# full detail of the most recent run
lai show latest --verbose

# the last 20 runs, newest first
lai history --limit 20

# label a run for grouping/filtering
lai tag latest baseline v1

# aggregate stats across tagged runs
lai stats --tag baseline

# export for external analysis
lai export latest --format json --output run.json
```

::: warning Eval output shown here is purely illustrative
Any scores or counts shown on this page are examples of the output *format*, not numbers
reproduced from a real model run.
Your suites, case counts, scores, and run paths will differ.
Also don't forget that the stub cases report a placeholder score, not an actual measurement.
:::

## Next steps

- **[Command reference](/langium-ai/usage)**: all flags for `evaluate`, `show`, `compare`,
  `stats`, `export`, `tag`, and `clean`.
- **[Authoring eval files](/langium-ai-tools/evals)**: the full `describe` / `evaluation` API.
- **[Evaluator](/langium-ai-tools/evaluator)**: `LangiumEvaluator`, custom evaluators, and the
  evaluation matrix.
- **[Agent skills](/skills/)**: have an agent expand the eval suite and refine the prompt for you.
