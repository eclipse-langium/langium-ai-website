---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Langium AI"
  text: "AI toolbox for grounding LLMs on Langium DSLs"
  tagline: "Build, evaluate, and refine AI-powered tooling for your Langium DSL — provider-agnostic, and grounded in your DSL's grammar."
  image:
    src: /lai.svg
    alt: Langium
  actions:
    - theme: brand
      text: Get started
      link: /quickstart
    - theme: alt
      text: Core library
      link: /langium-ai-tools/
    - theme: alt
      text: GitHub
      link: https://github.com/eclipse-langium/langium-ai

features:
  - title: langium-ai-tools (the tools)
    details: "Contributes provider-agnostic building blocks for AI applications that leverage Langium DSLs. All built on your existing DSL service set. Provides evaluating, analyzing, splitting, and a vitest-style evals API."
    link: /langium-ai-tools/
  - title: langium-ai (the CLI)
    details: CLI to bootstrap and iterate. Quickly set up langium-ai-tools, capture your project state in a descriptor, and set up ready to implement evaluations. Allows you to run evaluations in workflows, capture evaluation results, and tracking your AI application's improvement over time.
    link: /langium-ai/
  - title: Agent Skills (the know-how)
    details: Equip coding agents (Claude Code, Codex, Gemini, Copilot, etc.) to work with the LAI toolkit and Langium projects in general.
    link: /skills/
---

## What is Langium AI?

[![npm - langium-ai-tools](https://img.shields.io/npm/v/langium-ai-tools?label=langium-ai-tools&logo=npm)](https://www.npmjs.com/package/langium-ai-tools) [![npm - langium-ai](https://img.shields.io/npm/v/langium-ai?label=langium-ai&logo=npm)](https://www.npmjs.com/package/langium-ai)

Langium AI is a suite of tools that make it easier to build AI applications with [Langium](https://langium.org) DSLs.

It provides a core library (langium-ai-tools), a CLI tool (langium-ai), and a set of agent skills that work together to allow you to build, evaluate, refine, and repeat. This makes it easy to measure whether changes to your AI application (model, prompt, context management, MCP, tools, and more) are actually improving your results, rather than just guessing.

We created Langium AI out of a desire to do this very kind of checking on Langium DSLs, and to really codify it in a way that's both effective and easy to use.

These problems are at the core of what we try to solve with Langium AI:

- **Model selection**: Figuring out which models are best suited for your DSL, factoring in price, performance, and speed.
- **Context management**: Determining what techniques, new and old, give consistently great results for your DSL.
- **Evaluating DSL output**: Scoring performance on evaluation cases against your parser, validations, type checker, and more, and recording your results.
- **Processing DSL programs as data**: Exposing tools to generically process Langium-based DSL programs as data, making it easy to define syntactic rules for splitting, chunking, and analyzing documents in a DSL-respecting fashion.
- **Developing natural-language interfaces for DSLs**: Grounding an AI assistant on your language's implementation so it generates valid code with a high degree of trust.

Nothing is 100% with LLMs, which is both quite valuable from a flexibility standpoint, and immensely problematic. With Langium AI, we want to make it feasible to tame that non-determinism, and have greater trust and transparency in how you develop exceptional AI applications with Langium DSLs.

If you're interested, and new to this project, you can check out our **[Quickstart](/quickstart)** guide to get going quickly. This will walk you through installing `lai` (the langium-ai CLI) in your existing Langium project and getting evaluations set up.

For some background, you can also read [Langium AI: The fusion of DSLs and LLMs](https://typefox.io/blog/langium-ai-the-fusion-of-dsls-and-llms/), which first introduced this project.
