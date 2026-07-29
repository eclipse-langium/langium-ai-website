# Evaluating tool calls

Generating valid DSL text is one job an LLM can handle quite well.
However, deciding which tool to invoke, and with which arguments, is another.
LLMs can be exceptionally good at working with tools that are described to them, but a model that picks the right tool but fills in the wrong argument, calls a tool it shouldn't, or skips a required call entirely may pass a text-only evaluation while breaking your application later on.
These kinds of subtle issues can't be avoided 100% of the time, but you can absolutely evaluate known-good (and bad) cases where model behavior should generally include a certain set of tool calls with certain args.

In turn, this guide shows how to evaluate the **tool-call layer** of a response, using the same [evals](/langium-ai-tools/evals) and [evaluator](/langium-ai-tools/evaluator) machinery you already have for grading generated code.
The [MCP guide](/langium-ai-tools/mcp) covers the closely related case where those tools are served by an MCP server as well.

::: tip This builds on the provider setup
This guide assumes you've wired up at least one provider, as covered in the CLI [Examples](/langium-ai/examples#connecting-a-provider).
Here we extend that `evals/utils.ts` helper to return structured tool calls in addition to text.
:::

## The problem shape

The scaffolded `generateResponse()` returns a `Promise<string>`, which is perfect for grading generated programs, but a tool call doesn't fit in here.
Each provider hands tool calls back as a distinct structured shape.
For example, here are a few:

- **Anthropic** returns `tool_use` content blocks alongside any `text` blocks.
- **OpenAI** returns `message.tool_calls[]`, each with a `function.name` and a JSON-encoded `function.arguments` string.
- **Ollama** returns `message.tool_calls[]`, each with a `function.name` and an already-parsed `function.arguments` object.

Rather than cover every evaluation case for these and more, it's best to normalize them once into a single neutral shape that you can work with, and then evaluate against that. This keeps your evaluations provider-agnostic, the same way `langium-ai-tools` itself is.

## Working with a normalized tool call

Once you define a general tool call shape that your evaluations can rely on, you can add it in.
For our examples here, we'll add it into an `evals/types.ts` file so both `utils.ts` and your eval files can import it throughout:

```ts twoslash
// evals/types.ts
export interface ToolCall {
    name: string;                      // the tool the model chose to invoke
    arguments: Record<string, unknown>; // parsed arguments, never a raw string
}

export interface ToolResponse {
    text: string;          // any extra text accompanying the calls
    toolCalls: ToolCall[]; // zero or more calls, in the order the model emitted them
}
```

`arguments` is always a parsed object in our types here, but it's often returned as a string. For example, OpenAI hands you a JSON string, so if you don't parse it up front you'll have to handle it later. However, it's usually best to parse it up front once you get it back from the response.

## Extracting from each provider

You'll want to add a helper for getting tool responses (or update the existing `generateResponse` helper to do this).
Either choice is fine, but in our example we'll add a `generateToolResponse()` function alongside the existing `generateResponse()` in `evals/utils.ts`.
It'll take the same prompt and options, as well as the tool definitions to expose, and it'll return a normalized `ToolResponse` we can work with.

The tool definitions themselves are each dependent on their provider, so it helps to keep a single source of truth and adapt each to that.
Here's a shared definition that we'll use in all three examples below:

```ts twoslash
// evals/tools.ts: one general tool description we'll use in all examples
export const toolSpecs = [
    {
        name: 'generate_program',
        description: 'Generate a program in the target DSL from a natural-language request.',
        parameters: {
            type: 'object',
            properties: {
                description: { type: 'string', description: 'What the program should do' },
                entities: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Named entities the program must define'
                }
            },
            required: ['description']
        }
    }
] as const;
```

### Anthropic

Anthropic tool calls (as of **0.115.0**) arrive as `tool_use` blocks interleaved with `text` blocks in `response.content`. You can walk through the content once, and sort the blocks into text and calls.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: tools.ts
export const toolSpecs = [
    { name: 'generate_program', description: 'Generate a program.', parameters: { type: 'object' } }
] as const;
// @filename: utils.ts
// ---cut---
import Anthropic from '@anthropic-ai/sdk';
import type { ToolResponse } from './types.js';
import { toolSpecs } from './tools.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateToolResponse(
    prompt: string,
    options: { systemPrompt?: string } = {}
): Promise<ToolResponse> {
    const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        system: options.systemPrompt || '',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        tools: toolSpecs.map((t: typeof toolSpecs[number]) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters
        }))
    });

    const text: string[] = [];
    const toolCalls: ToolResponse['toolCalls'] = [];
    for (const block of response.content) {
        if (block.type === 'text') {
            text.push(block.text);
        } else if (block.type === 'tool_use') {
            // Anthropic parses args for you: so block.input is an object we can already use
            toolCalls.push({ name: block.name, arguments: block.input as Record<string, unknown> });
        }
    }

    return { text: text.join(''), toolCalls };
}
```

Anthropic's `tool_use.input` is already a parsed object, so no additional parse is required.
Additionally, when the `stop_reason` is `tool_use`, the model chose to call at least one tool.
When it's `end_turn`, it answered normally without calling anything.
This can be helpful during evaluation for determining whether a tool call was made in the first place, and if so, whether it was the expected one.

### OpenAI

OpenAI puts calls under `message.tool_calls`, and importantly `function.arguments` is a **JSON string** here, not an object.
You'll need to parse it so downstream code never has to.

```ts twoslash
/// <reference types="node" />
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: tools.ts
export const toolSpecs = [
    { name: 'generate_program', description: 'Generate a program.', parameters: { type: 'object' } }
] as const;
// @filename: utils.ts
// ---cut---
import OpenAI from 'openai';
import type { ToolResponse, ToolCall } from './types.js';
import { toolSpecs } from './tools.js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateToolResponse(
    prompt: string,
    options: { systemPrompt?: string } = {}
): Promise<ToolResponse> {
    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: options.systemPrompt || '' },
            { role: 'user', content: prompt }
        ],
        max_tokens: 2048,
        tools: toolSpecs.map((t: typeof toolSpecs[number]) => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description, parameters: t.parameters }
        }))
    });

    const message = response.choices[0].message;
    const toolCalls: ToolCall[] = (message.tool_calls ?? []).flatMap((call): ToolCall[] => {
        if (call.type !== 'function') {
            return [];
        }
        let args: Record<string, unknown> = {};
        try {
            // get args from string
            args = JSON.parse(call.function.arguments);
        } catch {
            // malformed, mark as unparsable
            args = { __unparsable: call.function.arguments };
        }
        return [{ name: call.function.name, arguments: args }];
    });

    return { text: message.content ?? '', toolCalls };
}
```

Note the handling of unparsable arguments.
Instead of throwing, we mark it as unparsable and proceed.
A model that emits invalid JSON for its arguments is a failure you'll likely want to evaluate, rather than have it crash.
You may handle it differently, but in either case it should be covered during evaluation.

### Ollama (local AI)

Ollama mirrors OpenAI's `message.tool_calls` structure, but its `function.arguments` is conveniently already an object.

```ts twoslash
/// <reference types="node" />
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: tools.ts
export const toolSpecs = [
    { name: 'generate_program', description: 'Generate a program.', parameters: { type: 'object' } }
] as const;
// @filename: utils.ts
// ---cut---
import ollama from 'ollama';
import type { ToolResponse } from './types.js';
import { toolSpecs } from './tools.js';

const MODEL = 'llama3.1';

export async function generateToolResponse(
    prompt: string,
    options: { systemPrompt?: string } = {}
): Promise<ToolResponse> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await ollama.chat({
        model: MODEL,
        messages,
        tools: toolSpecs.map((t: typeof toolSpecs[number]) => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description, parameters: t.parameters }
        }))
    });

    const toolCalls: ToolResponse['toolCalls'] = (response.message.tool_calls ?? []).map((call) => ({
        name: call.function.name,
        // args are already parsed
        arguments: call.function.arguments as Record<string, unknown>
    }));

    return { text: response.message.content ?? '', toolCalls };
}
```

You'll of course need to ensure you're checking a model that supports tool calling.
You can pull a tool-capable model, as a model without tool support will simply answer in text and return an empty `toolCalls`.

With all of this setup complete, every evaluation below is written to run against whichever provider you've wired up.

## Asserting on tool calls

Now for the evaluation itself.
A tool-call evaluation generally focuses on the following:
- Was the right tool called?
- Are the arguments correct?
- Was there anything that shouldn't have been called?

That's not all, but it's a great start to doing general checks.
We'll walk through each of these in the following sections.

### Was the expected tool invoked?

It's a basic check but important to make.
In this example, we'll simply set the score to 1 when the model called the expected tool, and 0 otherwise.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: utils.ts
import type { ToolResponse } from './types.js';
export declare function generateToolResponse(prompt: string, options?: { systemPrompt?: string }): Promise<ToolResponse>;
// @filename: assert.ts
import type { ToolCall } from './types.js';
export declare function called(calls: ToolCall[], name: string): boolean;
export declare function firstCall(calls: ToolCall[], name: string): ToolCall | undefined;
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { generateToolResponse } from './utils.js';
import { called } from './assert.js';

describe('Tool selection', () => {
    evaluation('invokes generate_program for a generation request', async (ctx: EvalContext) => {
        const { toolCalls } = await generateToolResponse('Create a program with two entities.', {
            systemPrompt: ctx.systemPrompt
        });
        // where called returns true/false if the given tool was called
        return { score: called(toolCalls, 'generate_program') ? 1 : 0 };
    });
});
```

### Were the arguments correct?

Selecting the right tool but providing the wrong arguments is another case to evaluate.
Arguments need to be graded for correctness, and in our example we'll give partial credit so a near-match scores higher than something that's far off.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: utils.ts
import type { ToolResponse } from './types.js';
export declare function generateToolResponse(prompt: string, options?: { systemPrompt?: string }): Promise<ToolResponse>;
// @filename: assert.ts
import type { ToolCall } from './types.js';
export declare function called(calls: ToolCall[], name: string): boolean;
export declare function firstCall(calls: ToolCall[], name: string): ToolCall | undefined;
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { generateToolResponse } from './utils.js';
import { firstCall } from './assert.js';

describe('Tool arguments', () => {
    evaluation('passes the requested entities as arguments', async (ctx: EvalContext) => {
        const { toolCalls } = await generateToolResponse(
            'Generate a program defining a Person and an Order entity.',
            { systemPrompt: ctx.systemPrompt }
        );

        // retrieve the first instance of this call, if any
        const call = firstCall(toolCalls, 'generate_program');
        if (!call) {
            // never called the tool
            return { score: 0, reason: 'generate_program was not called' };
        }

        // check the shape and content of what it passed
        const hasDescription = typeof call.arguments.description === 'string';
        const entities: unknown[] = Array.isArray(call.arguments.entities) ? call.arguments.entities : [];
        const mentionsPerson = entities.some((e: unknown) => /person/i.test(String(e)));
        const mentionsOrder = entities.some((e: unknown) => /order/i.test(String(e)));

        // partial credit: description present + each expected entity found
        const checks = [hasDescription, mentionsPerson, mentionsOrder];
        const score = checks.filter(Boolean).length / checks.length;

        const data = { score, hasDescription, mentionsPerson, mentionsOrder };
        return data;
    });
});
```

As with scoring generated programs, there's no single correct way to do this.
Weighting a missing required argument more heavily than an extra optional one, or scaling by how many expected entities were found, is entirely up to what matters for your use case.

### Were there any unexpected calls?

In some cases, a model might make calls to tools that were unexpected, or downright wrong.
Sometimes more than one valid tool applies to a question.
In either case, an evaluation can be crafted to account for both.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: utils.ts
import type { ToolResponse } from './types.js';
export declare function generateToolResponse(prompt: string, options?: { systemPrompt?: string }): Promise<ToolResponse>;
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { generateToolResponse } from './utils.js';

const KNOWN_TOOLS = new Set(['generate_program']);

describe('Tool restraint', () => {
    evaluation('answers a plain question without calling a tool', async (ctx: EvalContext) => {
        const { toolCalls } = await generateToolResponse(
            'What kinds of entities does this DSL support?',
            { systemPrompt: ctx.systemPrompt }
        );

        // just a question that shouldn't trigger a tool call (in this example)
        return { score: toolCalls.length === 0 ? 1 : 0, callCount: toolCalls.length };
    });

    evaluation('does not invent an unknown tool', async (ctx: EvalContext) => {
        const { toolCalls } = await generateToolResponse('Generate a small example program.', {
            systemPrompt: ctx.systemPrompt
        });

        const hallucinated = toolCalls.filter((c) => !KNOWN_TOOLS.has(c.name));
        return { score: hallucinated.length === 0 ? 1 : 0, hallucinated: hallucinated.map((c) => c.name) };
    });
});
```

### Composing with the LangiumEvaluator

Tool-call checks and DSL validity aren't mutually exclusive checks, as often a tool's argument is a DSL program, and you need to grade both.
Because our `generateToolResponse()` function returns arguments as data, you can pull a program out of a tool call, and hand it straight to a [`LangiumEvaluator`](/langium-ai-tools/evaluator) for followup.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
export interface ToolResponse { text: string; toolCalls: ToolCall[]; }
// @filename: utils.ts
import type { ToolResponse } from './types.js';
export declare function generateToolResponse(prompt: string, options?: { systemPrompt?: string }): Promise<ToolResponse>;
// @filename: assert.ts
import type { ToolCall } from './types.js';
export declare function firstCall(calls: ToolCall[], name: string): ToolCall | undefined;
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import { EmptyFileSystem } from 'langium';
import { createMiniLogoServices } from 'langium-minilogo/module';
import { generateToolResponse } from './utils.js';
import { firstCall } from './assert.js';

const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;
const evaluator = new LangiumEvaluator(services);

describe('Tool call produces valid DSL', () => {
    evaluation('generate_program emits a program that parses and validates', async (ctx: EvalContext) => {
        const { toolCalls } = await generateToolResponse('Generate a minimal valid program.', {
            systemPrompt: ctx.systemPrompt
        });

        const call = firstCall(toolCalls, 'generate_program');
        const program = call && typeof call.arguments.program === 'string' ? call.arguments.program : undefined;
        if (!program) {
            return { score: 0, reason: 'no program argument to grade' };
        }

        // hand the tool's argument to the Langium evaluator
        const result = await evaluator.evaluate(program, '');
        const score = result.data.errors === 0 ? 1 : Math.max(0, 1 - result.data.errors * 0.2);

        const data = { score, errors: result.data.errors, warnings: result.data.warnings };
        return data;
    });
});
```

This shows the benefit of normalizing early on.
The tool-call layer and the DSL layer are now graded by the same suite, but you can tell whether a failure stems from calling the wrong tool, or calling the right tool with some invalid program.

## Some extra points to keep in mind

- **Throwing is safe.** As with any evaluation case, if extraction or grading throws, the runner records `score: 0` with the error and moves on. But it is often preferred to catch these exceptions and score them with known failure modes (unparsable arguments, missing calls) so the report gives you more detail that you've accounted for explicitly.
- **Extra data is preserved.** The runner stores whatever object you return, so `callCount`, `hallucinated`, per-argument booleans, and the like all land in `lai history`.
- **Tool-call output isn't reproducible.** Like generated code, which tool a model picks and how it fills arguments varies run to run. Use `num_runs` and averaging to reason about it, rather than trusting a single run in isolation.

## Related

- **[Evaluating MCP](/langium-ai-tools/mcp)**: the same approach when tools are served by an MCP server, plus checks specific to the MCP round-trip.
- **[Evals](/langium-ai-tools/evals)**: the `describe` / `evaluation` API these cases are written in.
- **[Evaluator](/langium-ai-tools/evaluator)**: `LangiumEvaluator` and custom evaluators, for grading the DSL that a tool call produces.
- **[Connecting a provider](/langium-ai/examples#connecting-a-provider)**: the `generateResponse()` setup this guide's `generateToolResponse()` extends.
