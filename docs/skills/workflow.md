# Typical Workflow

Skills and the CLI are designed to work together effectively.
The [`lai` CLI](/langium-ai/) provides the generators and the evaluation loop, while the [actionable skills](/skills/actionable) drive that loop with you.
In addition, the [reference skills](/skills/reference) keep an agent grounded in how LAI and Langium work throughout.
This guide goes over how this synergy works in practice, moving from initializing, through evaluating and refining, to getting a reusable language skill.

## The combined loop

A typical agent-assisted run, mapping each step to the skill and/or CLI command that drives
it:

| Step | Skill | CLI command | Outcome |
|---|---|---|---|
| 1. Init | `lai` (reference) | `lai init` | `lai.config.jsonc`, an `evals/` directory with `utils.ts` and a starter `basic.eval.ts` |
| 2. Descriptor | [`lai-gen-descriptor`](/skills/actionable#lai-gen-descriptor) | `lai gen descriptor` | a refined `<language>.descriptor.yml` |
| 3. System prompt | [`lai-gen-sysprompt`](/skills/actionable#lai-gen-sysprompt) | `lai gen sysprompt` | a `<language>.sysprompt.md` |
| 4. Evals | [`lai-gen-evals`](/skills/actionable#lai-gen-evals) | — | a suite of `.eval.ts` files with real coverage |
| 5. Evaluate | `lai` (reference) | `lai evaluate` | scored results to review and iterate on |
| 6. MCP server | [`lai-gen-mcp`](/skills/actionable#lai-gen-mcp) | — | an `mcp/` server for DSL validation |
| 7. Language skill | [`lai-gen-language-skill`](/skills/actionable#lai-gen-language-skill) | — | a `SKILL.md` for your DSL |

You can run any step by hand, but the value of pairing skills with the CLI is that an agent
carries out the software-engineering work around each command, and improves on the baseline
descriptor and system prompt the generators emit on their own.

## Where reference skills plug in

The [`lai`](/skills/reference#lai) and [`langium`](/skills/reference#langium) reference skills
aren't direct steps in the loop. An agent brings them in as context to assist in the process.
The `lai` skill tells the agent what each command produces and how the loop fits together.
The `langium` skill gives it the grounding to describe your grammar, validation, and scoping accurately in the descriptor,
prompt, evals, and generated skill.
Every actionable skill explicitly leans on both in one way or another.

## Where actionable skills fire

Steps 2, 3, 4, 6, and 7 above are associated with actionable skills. Most bootstrap an artifact with a
`lai gen ...` command when none exists, then guide refinement from there. So they fit naturally after
the CLI has generated its output, and before you have a version that's dialed in for your language. See each
skill's entry on the [actionable skills](/skills/actionable) page for what it produces and
when to reach for it.

## Iterate, iterate, iterate

The loop isn't one-directional. Step 5, `lai evaluate`, is where the useful information feeds back into the loop and drives subsequent iterations:

- **Low pass rates or recurring failure categories** feed into
  [`lai-gen-sysprompt`](/skills/actionable#lai-gen-sysprompt). The skill helps to diagnose failure patterns and makes targeted prompt improvements.
- **Failures that trace back to missing or wrong project information** may feed into [`lai-gen-descriptor`](/skills/actionable#lai-gen-descriptor). This leads to correcting the descriptor, then updating (or regenerating) the prompt.
- **Shallow coverage**: everything passes but only trivial cases are tested. This feeds into
  [`lai-gen-evals`](/skills/actionable#lai-gen-evals) to broaden the suite before you start trusting the results.

After any of these changes, you (or your agent) would re-run `lai evaluate` and repeat. Refine descriptor and prompt, re-evaluate, and
observe the score delta.
Based on the delta, you would make changes, improve your evaluation suite, and run again.
The resulting effect is an increasingly refined evaluation suite, and an improved AI stack.

## See also

- [Usage](/langium-ai/usage): the full `lai` command reference behind steps 1–5.
- [Examples](/langium-ai/examples): the evaluation workflow end to end.
- [Reference skills](/skills/reference) & [Actionable skills](/skills/actionable): per-skill
  details.
