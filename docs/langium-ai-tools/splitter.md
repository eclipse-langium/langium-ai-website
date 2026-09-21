# Splitter

Generic text splitters can chunk a document at some character count, a line count, on blanks, or with a regex.
For a DSL that's quite arbitrary: it can break declarations in half, separate constructs from their comments, and produce chunks that can't be parsed on their own.

Thankfully, the solution is pretty easy: reuse the internal parser and abstract syntax types that Langium builds for you.

To this end, the splitter uses your language's own parser instead. You also describe the nodes you're interested in via predicates over the AST, and you get back chunks that line up with real syntactic boundaries.
This is what you want before embedding documents into a vector DB, feeding examples to a model, or building a repo-level map of a codebase.

The splitter is fairly straightforward, with three entrypoints, in increasing order of control:

| Function | Returns | Use when |
|---|---|---|
| `splitByNode` | `string[]` | You want text chunks along node boundaries. |
| `splitByNodeToAst` | `AstNode[]` | You want the nodes themselves and will handle text yourself. |
| `ProgramMapper` | `string[]` | You want a condensed *summary* line per node, not its source. |

And their imports for reference:

```ts twoslash
import {
    splitByNode,
    splitByNodeToAst,
    ProgramMapper
  } from 'langium-ai-tools/splitter';
```

<!--
  TODO(blocked by upstream bug): every worked example + sample output on this page is
  omitted because the splitter cannot currently run. All three entrypoints funnel through
  the internal parseDocument(), which hardcodes URI.parse('memory://document.langium').
  The double slash makes 'document.langium' the URI *authority*, leaving the path empty, so
  Langium's DefaultServiceRegistry.getServices() resolves an empty extension and throws:

      Error: The service registry contains no services for the extension ''.

  Verified against langium-ai-tools@5.0.6 with langium 4.2.x; the same line is present in
  the 4.2.2 source, so this is long-standing rather than a 5.x regression. There is no
  caller-side workaround: the URI is not configurable, and the '.langium' extension is
  hardcoded too (it should come from services.LanguageMetaData.fileExtensions[0]).

  Once fixed upstream (memory:/document<ext> + extension from LanguageMetaData) and the
  docs' pinned version is bumped, add here:
    - splitByNode worked example with a function-style DSL + its ['function foo() {...}', ...] output
    - the commentRuleNames contrast: default (comment attached to the chunk) vs [] (comment dropped)
    - splitByNodeToAst example showing the returned node types
    - ProgramMapper example with mappingRules + its ['func foo', 'func bar'] output
    - the "try it against the Langium grammar language" runnable snippet using
      createLangiumGrammarServices from 'langium/grammar' (needs no user DSL; this is the
      same fixture packages/examples/example-dsl-evaluator uses)
-->

## `splitByNode`

```ts twoslash
import { AstNode } from "langium";
import { LangiumServicesLike } from "langium-ai-tools";
import { SplitterOptions } from "langium-ai-tools/splitter";
// ---cut---
function splitByNode(
    document: string,
    nodePredicates: Array<(node: AstNode) => boolean> | ((node: AstNode) => boolean),
    services: LangiumServicesLike,
    options?: SplitterOptions
): string[]
// ---cut-after---
{
  return [];
}
```

| Parameter | Meaning |
|---|---|
| `document` | The DSL source to split, as a string. |
| `nodePredicates` | One predicate, or an array of them. A node is picked up if **any** predicate matches. |
| `services` | Your language's services, which is the same object you get from `createMyDslServices(...).MyDsl`. Used to parse the document. |
| `options.commentRuleNames` | Comment terminal rule names to pull into each chunk. Defaults to `['ML_COMMENT', 'SL_COMMENT']`. You can pass `[]` to exclude comments. |

Predicates run over every node in the AST, so `(node) => node.$type === 'Func'` chunks by
whatever rule corresponds to the `Func` AST type. Using Langium's generated AST types, you can import type guards
(e.g. `isFunc(node)`) to perform the same task.

By default, comments become part of the chunk they document. For each matched node the splitter looks for
an attached comment node and, if it finds one, starts the chunk at the comment instead of the
declaration. That's _usually_ what's desired for retrieval, especially for semantic search. When it isn't, you can pass `commentRuleNames: []` to keep comments out of the chunk.

:::tip
The default comment rule names assume Langium's conventional hidden terminal names. If your grammar
calls its hidden comment terminals something else, pass those names, otherwise comments are silently left out.
:::

Empty and unparsable input does not produce an error. An empty document, or one with lexer or parser
errors, produces `[]` (with the errors logged to the console) rather than throwing.
If you're splitting model-generated text, an empty result indicates the output is empty or didn't parse.
To distinguish between the two, it's recommended you first parse and validate your program text before splitting.

## `splitByNodeToAst`

```ts twoslash
import { AstNode } from "langium";
import { LangiumServicesLike } from "langium-ai-tools";

// ---cut---
function splitByNodeToAst(
    document: string,
    nodePredicates: Array<(node: AstNode) => boolean> | ((node: AstNode) => boolean),
    services: LangiumServicesLike
): AstNode[]
// ---cut-after---
{
  return [];
}
```

This function is identical in terms of its predicate matching, but instead returns the matching AST nodes.
Reach for this when you're building your own serialization logic, custom filtering or post-processing on nodes, cross-reference handling logic, or really anything that doesn't fall into the `splitByNode` function's jurisdiction.
This one has no `options` parameter, since you're taking the serialization matter into your own hands.

## `ProgramMapper`

```ts twoslash
import { LangiumServicesLike, ProgramMapOptions } from "langium-ai-tools";
// ---cut---
class ProgramMapper {
    constructor(services: LangiumServicesLike, options: ProgramMapOptions) {}
    map(document: string): string[] { return []; }
}
```

Where `splitByNode` gives you the source of each match, the `ProgramMapper` gives you a way to supply your own mapping rules for specific nodes.
The key use case for this is when you need to create a program or repo map, usually used as a compressed representation of a program or repo to be placed into context. The closest analogy is to importing a header file to get declarations without definitions or implementation details, it's often enough information to determine what's going to be most helpful for your task.

| Field | Type | Meaning |
|---|---|---|
| `mappingRules` | `MappingRule[]` | Applied in order; each has a `predicate` and a `map`. |
| `MappingRule.predicate` | `(node: AstNode) => boolean` | Which nodes this rule handles. |
| `MappingRule.map` | `(node: AstNode) => string` | The text to emit for a matched node. |

The result is one string per matched node, in document order.
This constructs something akin to an outline of the program.
These maps are cheap to build, small enough to sit in a system prompt, and enough for a model to know what exists and ask for the rest as needed.

## Related

- **[Analyzer](/langium-ai-tools/analyzer)**: measures which grammar rules a corpus exercises;
  a natural companion when you're looking for syntactic coverage in a set of documents.
- **[Examples](/langium-ai-tools/examples)**: an example project which includes splitter and program
  map usage.
