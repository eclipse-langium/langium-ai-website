# Analyzer

The `LangiumDocumentAnalyzer` answers an important question that comes up as soon as you have a set of DSL
programs: *How much of what my language can express does this corpus contain?*

It's the same question regardless of your stack, model, its associated tools, and how you're ultimately generating and post-processing your outputs.
An example corpus for training, validation, evaluation, etc., that reflects only a portion of your language will naturally only test a portion of your language.

A corpus of a hundred, a thousand, or a million programs will not help you if you haven't covered the extent of what your language can express (syntactically and semantically).

For the syntactic part, **this is where the analyzer helps the most**. The analyzer counts how often each grammar rule is exercised, what fraction of your rules appear at all, and how evenly the usage is spread.
This enables you to assess the coverage of syntactic categories in your language through your corpus, as well as distribution of those categories, and potential omissions.

It extends the base [`LangiumEvaluator`](/langium-ai-tools/evaluator), so you also get the usual parse-and-validate
diagnostics.
The coverage statistics are then added on top, into the result's metadata.

## Analyzing a document

Analysis is a two-step process.
First `evaluate()` produces a normal evaluator result (with the statistics tucked into `metadata` under `syntax_statistics`).
Second, `extractStatisticsFromResult()` digs the statistics back out.
It returns `undefined` when no statistics were collected, which is how you'll notice you're in `NO_STATISTIC` mode (the default is `ALL`, so normally you'll get your statistics unless otherwise specified).

```ts twoslash
const program: string = 'pen(down) move(10, 10) pen(up)';
const expectedResponse: string = 'the corpus program to compare against';
// ---cut---
import { EmptyFileSystem } from 'langium';
import { LangiumDocumentAnalyzer, AnalysisMode } from 'langium-ai-tools/analyzer';
import { createMiniLogoServices } from "langium-minilogo/module";

const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;
const analyzer = new LangiumDocumentAnalyzer(services, {
    analysisMode: AnalysisMode.ALL
});

const result = await analyzer.evaluate(program, expectedResponse);
const stats = analyzer.extractStatisticsFromResult(result);

console.log(stats?.coverage);   // percentage of rules used at least once
console.log(stats?.ruleUsage);  // { RuleName: count, … }
console.log(stats?.diversity);  // { entropy, giniCoefficient, simpsonIndex }
```

`evaluate()` inherits everything documented on the [evaluator page](/langium-ai-tools/evaluator#langiumevaluator).
It's async, it extracts the first fenced code block if the input has one, and it has an optional second argument for a file extension.

## Options

`LangiumDocumentAnalyzer` takes a few arguments; the middle one is of interest for us here:

```ts twoslash
import { EmptyFileSystem } from "langium";
import {LangiumDocumentAnalyzer } from "langium-ai-tools/analyzer";
import { GrammarImportResolver } from "langium-ai-tools";
import { resolveTransitiveImports } from "langium/grammar";
import { createMiniLogoServices } from "langium-minilogo/module";
const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;

const analysisOptions = {
    includeImportedRules: true
};

const documents = services.shared.workspace.LangiumDocuments;
const importResolver: GrammarImportResolver = {
    resolveImports: (grammar) => resolveTransitiveImports(documents, grammar)
};
//---cut---

new LangiumDocumentAnalyzer(services, analysisOptions, importResolver);
```

`analysisOptions` is an optional object with the following props:

| Option | Default | Effect |
|---|---|---|
| `analysisMode` | `AnalysisMode.ALL` | `ALL` collects statistics; `NO_STATISTIC` skips them and leaves you with a plain validation result. |
| `excludeRules` | `[]` | Rule names to leave out entirely, such as deprecated or irrelevant rules. |
| `includeImportedRules` | `true` | Whether rules from imported grammars count. Requires an `importResolver` (see below) to work. |
| `includeHiddenRules` | `true` | Whether hidden terminals (comments, and other hidden tokens) are counted. |
| `computeDiversity` | `true` | Whether to compute the three diversity metrics. Turn it off if you only want coverage. |

Two exclusions are baked in: the terminal rule `WS` is always excluded, and the *entry* rule is excluded as well.
An entry rule is always present in a parsable document, so it'll always be present in our results and can actually skew the relative distribution a bit.

With `computeDiversity: false`, the `diversity` object is still present, with all three metrics set
to `0`. Be sure to check the flag you passed rather than reading zeros as indicating everything is used uniformly.

### Imported grammars

Resolution of imported grammar rules is governed by `includeImportedRules`.
This defaults to `true`, but the analyzer won't resolve imports by itself.
You have to give it a resolver to fill the gap, and Langium's own `resolveTransitiveImports` works excellently in most cases:

```ts twoslash
import { EmptyFileSystem } from "langium";
import { LangiumDocumentAnalyzer } from "langium-ai-tools/analyzer";
import { createMiniLogoServices } from "langium-minilogo/module";
const services = createMiniLogoServices(EmptyFileSystem).MiniLogo;
const grammar = "...";
// ---cut---
import { resolveTransitiveImports } from 'langium/grammar';

const documents = services.shared.workspace.LangiumDocuments;
const analyzer = new LangiumDocumentAnalyzer(services, { includeImportedRules: true }, {
    resolveImports: (grammar) => resolveTransitiveImports(documents, grammar)
});
```

Without a resolver, the analyzer *quietly* falls back to the rules declared directly in your grammar.
For a single-file grammar that's not an issue, but for a grammar with imports it means your coverage denominator is only a part of the actual language described.

Also, if import resolution throws, the rule set will come back empty.
So if you see a suspiciously empty `ruleUsage`, it might be a sign your resolver failed to load as expected.

## Reading the statistics

`SyntaxStatistic` is one of the package's generated message types and is used to describe the statistics produced by analysis.
It's the return type of `extractStatisticsFromResult` as well.
When needed, you can import it via `SyntaxStatistic` from `langium-ai-tools`.

```ts twoslash
type SyntaxStatistic = {
    ruleUsage: Record<string, number>;
    coverage: number;
    diversity: { entropy: number; giniCoefficient: number; simpsonIndex: number };
};
```

**`ruleUsage`** maps every rule in scope to how many times the document _used_ it. Rules that never
appear are present with a count of `0`, which can give you a sense of what you're missing across all your examples.

**`coverage`** is a **percentage** (expressed 0–100 as a literal percentage value, no need to multiply by 100) that describes the share of rules used at least once, i.e. how many rules an example is using (and implicitly how many it's not using).

**`diversity`** describes the *shape* of rule usage rather than its breadth:

| Metric | Range | Reading |
|---|---|---|
| `entropy` | >=0 | Shannon entropy over rule counts. Higher values suggest usage is spread across more rules. |
| `giniCoefficient` | 0–1 | Inequality. `0` is perfectly even usage; towards `1` suggests a few rules dominate. |
| `simpsonIndex` | 0–1 | Probability that two randomly drawn usages leverage different rules. Higher values suggest more variety in your examples. |

Coverage and diversity answer different questions, and both are quite important.
A corpus can touch 90% of your rules while spending 95% of its tokens on a few constructs.
The coverage is high, but the Gini coefficient will indicate that the distribution is not even.
That's a corpus that will train or evaluate a model to be fluent in one part of your language, and vague or unaware of another.

As an example, here's a result from analyzing a small Langium grammar against the Langium grammar language
itself:

```ts twoslash
const expectedResponse: string = 'a reference grammar to compare against';
// ---cut---
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumDocumentAnalyzer } from 'langium-ai-tools/analyzer';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const analyzer = new LangiumDocumentAnalyzer(services);

const stats = analyzer.extractStatisticsFromResult(await analyzer.evaluate(`grammar Demo

// the entry rule
entry Model: (greetings+=Greeting)*;

Greeting: 'hello' name=ID;

terminal ID: /[_a-zA-Z][\\w_]*/;
hidden terminal WS: /\\s+/;`, expectedResponse));
```

```
coverage:  36.1        // ~36% of the grammar language's rules appear
diversity: { entropy: 4.52, giniCoefficient: 0.73, simpsonIndex: 0.95 }
```

A Gini of `0.73` on a document this small is expected, only a handful of rules carry nearly all the usage.
Keeping an eye on that metric as you add examples is a decent way of determining if your corpus is increasing in breadth (i.e. more examples should tend toward a lower Gini coefficient) and not just getting larger.

## Analyzing a corpus

The analyzer only works one document at a time.
For aggregating, you need to process everything together yourself.
Thankfully, this is pretty straightforward, and summing `ruleUsage` is usually a good start:

```ts twoslash
const expectedResponse: string = 'a reference grammar to compare against';
// ---cut---
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { LangiumDocumentAnalyzer } from 'langium-ai-tools/analyzer';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const analyzer = new LangiumDocumentAnalyzer(services);

const totals: Record<string, number> = {};

const corpus: string[] = ['...', '...', '...'];

for (const program of corpus) {
    const stats = analyzer.extractStatisticsFromResult(await analyzer.evaluate(program, expectedResponse));
    for (const [rule, count] of Object.entries(stats?.ruleUsage ?? {})) {
        totals[rule] = (totals[rule] ?? 0) + count;
    }
}

const unused = Object.entries(totals)
    .filter(([, count]) => count === 0)
    .map(([rule]) => rule);

console.log(`${unused.length} unused rules:`, unused);
```

In cases where you have a good quantity of grammar rules, such an unused check can be invaluable for sanity checking your example coverage.

## What it doesn't measure

As helpful as analysis can be, these are just metrics with their own constraints.

Usage is counted from types that correspond to rules that are used when parsing your programs.
So the analyzer can only measure which types were produced (and, indirectly, which rules were reached in most cases).
It cannot detect correctness of usage, which is a semantic constraint.
Two documents that both call `Expression` once score identically whether the expression is a literal value or a deeply nested expression, and keyword-only alternatives inside a rule aren't distinguished.

This is most helpful as a map of which parts of your language your corpus expresses syntactically, not a judgement of semantic correctness.

## Related

- **[Evaluator](/langium-ai-tools/evaluator)**: the base class, result shape, and
  evaluation matrix.
- **[Splitter](/langium-ai-tools/splitter)**: chunking documents for ingest, the other half of
  corpus prep.

<!--
  TODO(blocked by upstream bug): the "drop the analyzer into an EvalMatrix as a
  LangiumEvaluator replacement" section is omitted. Because LangiumDocumentAnalyzer extends
  LangiumEvaluator, it inherits AbstractDocumentEvaluator.evaluate(input, fileExtension?) and
  hits exactly the same matrix incompatibility documented in evaluator.md: EvalMatrix calls
  evaluate(response, testCase.expected_response), the expected response is treated as a file
  extension, and Langium's service registry throws
  "The service registry contains no services for the extension ''."
  Add the drop-in example (and its cross-link from evaluator.md) once fixed upstream.

  TODO(blocked by upstream bug): result.data.responseLength is not documented here for the
  same reason as on the evaluator page — it's always 0, while the real value lands in the
  undeclared `response_length`. This has since been fixed, `responseLength` is correctly populated now
-->
