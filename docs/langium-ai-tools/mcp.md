# Evaluating MCP

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) lets a model reach tools served by some external process, such as a filesystem, a database connector, or a server you write to expose your Langium language's own LSP-related capabilities (parse, validate, generate).
When you put an MCP server in front of a model, you're adding some additional moving parts.
In particular, the interaction flow introduces a number of points that need checking:
- Server advertises tools
- Model chooses among those tools
- Provider routes the call
- Server executes the call
- Server returns a result

Any link in that chain is a potential point of failure that can be missed in a simple text-only check.

This guide covers evaluating the **MCP round-trip**.
It's quite closely related to the guide on [Evaluating tool calls](/langium-ai-tools/tool-calls), as both help produce grades for similar circumstances, but MCP adds concerns the plain tool-call case doesn't have.
Namely, the tool list is defined by a server that you may or may not fully control.
In addition, calls travel through a connector, and there's an execution result to check as well.
If you haven't read the tool-calls guide, we recommend you start there, as this one assumes we'll be using the normalized `ToolCall` type it introduces.

## Two ways a provider talks to MCP

There are two main integration styles, and they change where you extract the tool call from:

1. **Server-side connector**: the provider connects to the MCP server for you. You declare the server on the request; the provider discovers its tools, and calls come back tagged as MCP calls. Anthropic's Messages API MCP connector works this way.
2. **Client-side loop**: you run an MCP client yourself (via the [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)), list the server's tools, hand them to the model as ordinary tool definitions, and dispatch any calls the model makes back to the server. This works with *any* provider, including OpenAI and Ollama, since to the model it's just tool use.

Both boil down to the same normalized type from the [tool-calls guide](/langium-ai-tools/tool-calls#a-normalized-tool-call), so your evaluations generally should not need to care which approach produced the call. We'll extract each into an `McpResponse`:

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }
// @filename: mcp-types.ts
// ---cut---
import type { ToolCall } from './types.js';

export interface McpCall extends ToolCall {
    server: string; // which MCP server the tool belongs to
}

export interface McpResponse {
    text: string;
    toolCalls: McpCall[];      // calls the model made against MCP tools
    availableTools: string[];  // tool names the server actually advertised
}
```

The extra `availableTools` field is the MCP-specific part. Because the tool list comes from the server, it captures what was offered and lets you evaluate based on this list as well as the model's choice.

## Extracting the MCP round-trip

### Anthropic's server-side connector

With the connector, you pass `mcp_servers` and a matching `mcp_toolset` in `tools`.
Anthropic then handles discovery and routing.
MCP calls will then come back as `mcp_tool_use` blocks (distinct from ordinary `tool_use`), each tagged with their respective server name.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }

export interface McpCall extends ToolCall {
    server: string; // which MCP server the tool belongs to
}

export interface McpResponse {
    text: string;
    toolCalls: McpCall[];      // calls the model made against MCP tools
    availableTools: string[];  // tool names the server actually advertised
}
// @filename: main.ts
// ---cut---
import Anthropic from '@anthropic-ai/sdk';
import type { McpResponse } from './types.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateMcpResponse(
    prompt: string,
    options: { systemPrompt?: string } = {}
): Promise<McpResponse> {
    const response = await client.beta.messages.create({
        model: 'claude-sonnet-4-5',
        system: options.systemPrompt || '',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        betas: ['mcp-client-2025-11-20'],
        // declare the server using an mcp connector
        mcp_servers: [
            { type: 'url', name: 'langium-dsl', url: process.env.MCP_SERVER_URL ?? '' }
        ],
        // and reference it by name in tools, or the request is rejected
        tools: [{ type: 'mcp_toolset', mcp_server_name: 'langium-dsl' }]
    });

    const text: string[] = [];
    const toolCalls: McpResponse['toolCalls'] = [];
    for (const block of response.content) {
        if (block.type === 'text') {
            text.push(block.text);
        } else if (block.type === 'mcp_tool_use') {
            toolCalls.push({
                name: block.name,
                arguments: block.input as Record<string, unknown>,
                server: block.server_name
            });
        }
    }

    // the connector doesn't return the discovered list directly, see the note below
    return { text: text.join(''), toolCalls, availableTools: [] };
}
```

There are two things worth knowing about the connector.
First, `mcp_servers` by itself isn't enough, you also need to add the matching `mcp_toolset` entry, or the request fails validation.
Second, the connector discovers tools server-side and doesn't hand you the advertised list, so `availableTools` stays empty.
If you want to evaluate the server's tool list (the next section), you can query it directly with the MCP client, which the client-side path below does anyway.

### Client-side loop (any provider)

Running the MCP client yourself involves more code, but it works with nearly every provider and (usefully for evaluation) gives you the advertised tool list for free, since you're the one invoking `listTools()`.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }

export interface McpCall extends ToolCall {
    server: string; // which MCP server the tool belongs to
}

export interface McpResponse {
    text: string;
    toolCalls: McpCall[];      // calls the model made against MCP tools
    availableTools: string[];  // tool names the server actually advertised
}

// @filename: utils.ts
export interface ToolDef {
    name: string;
    description: string;
    parameters: unknown;
}

export interface ToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResponse {
    text: string;
    toolCalls: ToolCall[];
}

export async function generateToolResponse(prompt: string, options: {
    systemPrompt?: string,
    tools: ToolDef[]
}): Promise<ToolResponse> {
    return {
        text: '...',
        toolCalls: []
    };
}
// @filename: main.ts
/// <reference types="node" />
// ---cut---
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpResponse } from './types.js';
import { generateToolResponse } from './utils.js';

export async function generateMcpResponse(
    prompt: string,
    options: { systemPrompt?: string } = {}
): Promise<McpResponse> {
    // connect to the server and discover its tools
    const mcp = new Client({ name: 'lai-eval', version: '1.0.0' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_SERVER_URL ?? '')));

    const listed = await mcp.listTools();
    const availableTools = listed.tools.map((t) => t.name);

    // hand the discovered tools to the model as ordinary tool definitions
    const { text, toolCalls } = await generateToolResponse(prompt, {
        systemPrompt: options.systemPrompt,
        tools: listed.tools.map((t) => ({
            name: t.name,
            description: t.description ?? '',
            parameters: t.inputSchema
        }))
    });

    await mcp.close();

    // tag each call with the server it belongs to
    return {
        text,
        toolCalls: toolCalls.map((c) => ({ ...c, server: 'langium-dsl' })),
        availableTools
    };
}
```

This reuses the provider extraction we already wrote for the [tool-calls guide](/langium-ai-tools/tool-calls#extracting-from-each-provider).
The only additions are the `listTools()` discovery step and tagging calls with the server name.
To actually *execute* a call against the server (needed for the round-trip check further down), you'd also need to invoke `mcp.callTool({ name, arguments })` with the model's chosen call.

Naturally, it's important to ensure the server you're testing against is running while your evaluations are running, and _stays_ running. It's a small point, but it can easily ruin a large evaluation run that's unattended.

## What's worth evaluating about MCP

Everything from the [tool-calls guide](/langium-ai-tools/tool-calls#asserting-on-tool-calls) still applies: the right tool, right arguments, and no triggering on unhelpful tools.
MCP adds a few more checks that only make sense when a server is involved.

### The server advertises the tools you expect

Before you evaluate the *model*, it helps to sanity check the *server*, especially one that you don't control but depend on. A server that drops a tool, renames one, or ships a broken or modified schema can make every downstream model evaluation fail for reasons that have nothing to do with the model itself. It's a bit beyond evaluating the model, but consider it a precondition worth asserting.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }

export interface McpCall extends ToolCall {
    server: string; // which MCP server the tool belongs to
}

export interface McpResponse {
    text: string;
    toolCalls: McpCall[];      // calls the model made against MCP tools
    availableTools: string[];  // tool names the server actually advertised
}

// @filename: utils2.ts
export interface ToolDef {
    name: string;
    description: string;
    parameters: unknown;
}

export interface ToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResponse {
    text: string;
    toolCalls: ToolCall[];
}

export async function generateToolResponse(prompt: string, options: {
    systemPrompt?: string,
    tools: ToolDef[]
}): Promise<ToolResponse> {
    return {
        text: '...',
        toolCalls: []
    };
}
// @filename: utils.ts
/// <reference types="node" />
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpResponse } from './types.js';
import { generateToolResponse } from './utils2.js';

export async function generateMcpResponse(
    prompt: string,
    options: { systemPrompt?: string } = {}
): Promise<McpResponse> {
    // connect to the server and discover its tools
    const mcp = new Client({ name: 'lai-eval', version: '1.0.0' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_SERVER_URL ?? '')));

    const listed = await mcp.listTools();
    const availableTools = listed.tools.map((t) => t.name);

    // hand the discovered tools to the model as ordinary tool definitions
    //    (generateToolResponse from the tool-calls guide, taught to accept a tool list)
    const { text, toolCalls } = await generateToolResponse(prompt, {
        systemPrompt: options.systemPrompt,
        tools: listed.tools.map((t) => ({
            name: t.name,
            description: t.description ?? '',
            parameters: t.inputSchema
        }))
    });

    await mcp.close();

    // tag each call with the server it belongs to
    return {
        text,
        toolCalls: toolCalls.map((c) => ({ ...c, server: 'langium-dsl' })),
        availableTools
    };
}
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import { generateMcpResponse } from './utils.js';

const EXPECTED_TOOLS = ['validate_program', 'generate_program', 'list_entities'];

describe('MCP server contract', () => {
    evaluation('advertises the expected tool set', async () => {
        // a simple prompt, we just care about what the server offered, not the answer itself
        const { availableTools } = await generateMcpResponse('List what you can do.');

        const missing = EXPECTED_TOOLS.filter((t) => !availableTools.includes(t));
        const extra = availableTools.filter((t) => !EXPECTED_TOOLS.includes(t));

        // score based on whether the tool set aligns
        const score = missing.length === 0 && extra.length === 0 ? 1 : 0;
        return { score, missing, extra };
    });
});
```

This is, admittedly, a sanity check masquerading as an evaluation.
It's inherently pass/fail rather than a graded score, but running it *inside* the suite means a server regression shows up in the same report as everything else, right next to the model cases it would otherwise silently take down.
You can, of course, write logic that asserts this in advance in a similar way.
That would work perfectly fine as well, but you should ensure that you're performing the check using the _same_ MCP client that will be used in evaluation.

### The model routes to the correct MCP tool

This is the most central and important MCP check: given a request, does the model pick the right *server-provided* tool?
It has the same form as the tool-selection check in the sibling guide, but now the tool comes from the server instead.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }

export interface McpCall extends ToolCall {
    server: string;
}

export interface McpResponse {
    text: string;
    toolCalls: McpCall[];
    availableTools: string[];
}
// @filename: utils.ts
import type { McpResponse } from './types.js';

export declare function generateMcpResponse(
    prompt: string,
    options?: { systemPrompt?: string }
): Promise<McpResponse>;
// @filename: assert.ts
import type { ToolCall } from './types.js';

export declare function called(calls: ToolCall[], name: string): boolean;
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { generateMcpResponse } from './utils.js';
import { called } from './assert.js';

describe('MCP tool routing', () => {
    evaluation('routes a validation request to validate_program', async (ctx: EvalContext) => {
        const { toolCalls } = await generateMcpResponse('Check whether this program is valid.', {
            systemPrompt: ctx.systemPrompt
        });

        return {
            score: called(toolCalls, 'validate_program') ? 1 : 0
        };
    });
});
```

### The round-trip produces a usable result

The distinctive thing about MCP is that there's an actual server on the other side returning a result.
A model can call the right tool with the right arguments and *still* fail the task if it mishandles what comes back, or if the server returns an error that isn't accounted for properly in the model's harness.
Evaluating the full round-trip catches that.

This is where composing evaluations with the [`LangiumEvaluator`](/langium-ai-tools/evaluator) can help out.
If your MCP server's `generate_program` tool returns DSL text, you can then execute the call and grade the returned program exactly as you'd grade any generated code.

```ts twoslash
// @filename: types.ts
export interface ToolCall { name: string; arguments: Record<string, unknown>; }

export interface McpCall extends ToolCall {
    server: string;
}
// @filename: utils.ts
import type { McpCall } from './types.js';

export interface McpToolResult {
    isError: boolean;
    error?: string;
    content: unknown;
}

export declare function runMcpRoundTrip(
    prompt: string,
    options?: { systemPrompt?: string }
): Promise<{ call?: McpCall; result: McpToolResult }>;
// @filename: eval.ts
// ---cut---
import { describe, evaluation } from 'langium-ai-tools/evals';
import type { EvalContext } from 'langium-ai-tools/evals';
import { LangiumEvaluator } from 'langium-ai-tools/evaluator';
import { EmptyFileSystem } from 'langium';
import { createMiniLogoServices } from "langium-minilogo/module";
import { runMcpRoundTrip } from './utils.js';

const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;
const evaluator = new LangiumEvaluator(services);

describe('MCP round-trip', () => {
    evaluation('generate_program returns a program that validates', async (ctx: EvalContext) => {
        // runMcpRoundTrip
        //  generate a call, execute it against the server via mcp.callTool,
        //  and return { call, result } containing the server's actual response
        const { call, result } = await runMcpRoundTrip('Generate a minimal valid program.', {
            systemPrompt: ctx.systemPrompt
        });

        if (!call) {
            return { score: 0, reason: 'model called no MCP tool' };
        }
        if (result.isError) {
            // server rejected the call for some reason, note it
            return { score: 0, reason: 'MCP server returned an error', serverError: result.error };
        }

        // grade the program the server handed back
        const program = typeof result.content === 'string' ? result.content : '';
        const evalResult = await evaluator.evaluate(program, '');
        const score = evalResult.data.errors === 0 ? 1 : Math.max(0, 1 - evalResult.data.errors * 0.2);

        const data = { score, errors: evalResult.data.errors, warnings: evalResult.data.warnings };
        return data;
    });
});
```

There are three outcomes from the code above:
- No call was made
- The server produced an error
- The server produced a program and it was graded

By checking each of these, you can catch different points of failure in your AI application stack: whether the model routed a call correctly, whether the server had an error, whether arguments were invalid, or whether the generated DSL itself was invalid.
Combining the score makes it easier to tell that the run itself didn't perform to expectations in some way, while providing additional payload data can help differentiate the case.

In some cases you may want to be more granular about this kind of checking. The example above is just demonstrating one way to perform this kind of evaluation. In practice you may have multiple evaluations that check different aspects of the MCP call chain, or do post-processing on the generated evaluation result data itself.

## A note on the connector vs. client-side split

Which extraction path you evaluate against, as outlined above, is a choice that generally reflects your AI stack:

- If your **production** app uses Anthropic's server-side connector, you usually want to evaluate against that path, as you want your evaluations to exercise the same routing your users will run. However, populating `availableTools` requires a separate `listTools()` call if you want to do an MCP tools check.
- If you support **multiple providers** or run **local models**, the client-side loop is likely to work better, and it hands you the advertised tool list as well. It's also a more transparent path when you're debugging *why* a call went wrong, since every step is expressed in your own code.

Either way, the evaluations above are written against the normalized `McpResponse`, so switching paths is an implementation change to `utils.ts`, without messing with the abstraction layer.

## Things to keep in mind

- **Isolate the server.** MCP evaluations are only meaningful against a known server. A drifting or flaky server can quickly turn your model evaluations into noisy interference. If you're using an external server, pin the server fixture and treat it being offline as an environment failure, rather than a score.
- **Distinguish server errors from model errors.** An MCP call can fail because the *model* got it wrong or because the *server* rejected the call. Record which. This is why the round-trip case above returns `serverError`, to make it easier to detect these cases.
- **The sanity check guards against invalid runs.** Running a tool check first (or as a `beforeAll` sanity check) is an important first step before you start evaluating. If the server isn't offering what you think it should be, every other MCP case may fail to grade or grade erroneously.
- **These runs are not deterministic.** Routing decisions and arguments vary run to run, same with the generated code artifacts. Generally, it's better to lean on a statistical indication of correctness via `num_runs` and averaging, rather than trusting a run by itself.

## Related

- **[Evaluating tool calls](/langium-ai-tools/tool-calls)**: the foundational tool-call evaluation this guide extends. Covers normalized helper types, per-provider extraction, and the assertion helpers reused here.
- **[Evals](/langium-ai-tools/evals)**: the `describe` / `evaluation` API.
- **[Evaluator](/langium-ai-tools/evaluator)**: grading the DSL an MCP tool returns with `LangiumEvaluator`.
- **[Connecting a provider](/langium-ai/examples#connecting-a-provider)**: the provider setup both guides build on top of.
