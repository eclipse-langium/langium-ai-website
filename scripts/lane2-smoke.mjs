#!/usr/bin/env node
// ============================================================================
// Lane 2 of the docs gate — CLI smoke test (actually executes `lai`).
// ============================================================================
//
// This proves the `lai` CLI *plumbing* works end-to-end against real, pinned
// packages, from a clean temp dir, from the downstream consumer's perspective:
//
//   temp dir -> clone the minilogo fixture (pinned git SHA) -> build it
//            -> install pinned `lai` -> lai init --yes
//            -> lai gen descriptor/sysprompt --yes -> lai evaluate
//
// It exercises project detection, config/evals scaffolding, descriptor +
// sysprompt generation, eval discovery, the tsx/esm loader, and report
// writing. It does NOT prove real model results: the scaffolded
// `basic.eval.ts` returns a fixed STUB score BEFORE calling any provider, so
// this runs green with zero tokens and no model. See SITE-PLANNING.md, Lane 2.
//
// ─── package pins ───────────────────────────────────────────────────────────
// `langium-ai` and `langium-ai-tools` are consumed from public npm at exact
// versions. Keep these in sync with package.json's pinned deps when bumped.
// (REGISTRY is null: no custom registry needed for public npm. If a private
// pre-release registry is ever reintroduced, set REGISTRY.scope/url and the
// runner will write a temp-dir .npmrc so scoped installs resolve.)
// ----------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PINS = {
    // the `lai` CLI under test (installed as its bin `lai`)
    LAI_PKG: 'langium-ai@0.5.0',
    // the library `lai init --yes` installs into the fixture, and evals import
    TOOLS_PKG: 'langium-ai-tools@6.0.0',
    // custom scoped registry, or null for public npm (see PINS note above)
    REGISTRY: null,

    // the Langium project fixture: cloned fresh and pinned to an exact commit so
    // the gate is reproducible. Bump deliberately alongside the package pins.
    MINILOGO_REPO: 'https://github.com/langium/langium-minilogo.git',
    MINILOGO_SHA: '73593f6', // v4.0.1-7, reports package version 4.2.1
};

// ── small helpers ───────────────────────────────────────────────────────────

let step = 0;
function log(msg) {
    step += 1;
    console.log(`\n[lane2 ${step}] ${msg}`);
}
function fail(msg) {
    console.error(`\n✗ lane2 smoke FAILED: ${msg}`);
    process.exit(1);
}

// run a command, streaming output; throws (caught by the top-level guard) on
// non-zero exit. `allowFail` returns the caught error instead of throwing.
function run(cmd, args, opts = {}) {
    const { allowFail = false, ...rest } = opts;
    try {
        execFileSync(cmd, args, { stdio: 'inherit', ...rest });
        return { ok: true };
    } catch (err) {
        if (allowFail) {
            return { ok: false, err };
        }
        throw err;
    }
}

// write a temp-dir .npmrc so the private scope resolves during install (and so
// `lai init`'s internal `npm install langium-ai-tools@latest` resolves too).
function writeNpmrc(dir) {
    if (!PINS.REGISTRY) {
        return; // public npm: nothing to configure
    }
    const line = `${PINS.REGISTRY.scope}:registry=${PINS.REGISTRY.url}\n`;
    writeFileSync(path.join(dir, '.npmrc'), line, 'utf-8');
}

// ── the smoke test ──────────────────────────────────────────────────────────

const work = mkdtempSync(path.join(tmpdir(), 'lai-lane2-'));
const fixture = path.join(work, 'minilogo');
let cleanup = true;

try {
    log(`temp workdir: ${work}`);

    // 1. clone the fixture and pin to the exact commit
    log(`cloning minilogo (${PINS.MINILOGO_SHA})`);
    run('git', ['clone', '--no-checkout', PINS.MINILOGO_REPO, fixture]);
    run('git', ['-C', fixture, 'fetch', '--depth', '1', 'origin', PINS.MINILOGO_SHA], { allowFail: true });
    run('git', ['-C', fixture, 'checkout', PINS.MINILOGO_SHA]);

    // 2. build the fixture so its language services compile to importable .js
    //    (the rendered eval imports the compiled services module).
    log('installing + building the fixture');
    run('npm', ['ci'], { cwd: fixture });
    run('npm', ['run', 'langium:generate'], { cwd: fixture, allowFail: true });
    run('npm', ['run', 'build:tsc'], { cwd: fixture });

    // 3. make the private scope resolvable inside the fixture, then install the
    //    pinned tools lib and the `lai` CLI. These are SAVED into the fixture's
    //    package.json (not --no-save): `lai init` runs its own internal
    //    `npm install langium-ai-tools@latest`, and a plain `npm install`
    //    prunes extraneous (unsaved) packages — which would delete the `lai`
    //    and `tsx` bins out from under the next step.
    writeNpmrc(fixture);
    log(`installing tools + lai (${PINS.LAI_PKG})`);
    run('npm', ['install', PINS.TOOLS_PKG, PINS.LAI_PKG, 'tsx'], { cwd: fixture });

    // resolve the `lai` bin from the fixture's node_modules
    const lai = path.join(fixture, 'node_modules', '.bin', 'lai');
    if (!existsSync(lai)) {
        fail(`lai bin not found at ${lai} after install`);
    }

    // 4. lai init --yes: detect project, write config, scaffold evals
    log('lai init --yes');
    run(lai, ['init', '--yes'], { cwd: fixture });

    const configPath = path.join(fixture, 'lai.config.jsonc');
    const evalFile = path.join(fixture, 'evals', 'basic.eval.ts');
    if (!existsSync(configPath)) {
        fail('lai.config.jsonc was not created by `lai init --yes`');
    }
    if (!existsSync(evalFile)) {
        fail('evals/basic.eval.ts was not scaffolded by `lai init --yes`');
    }

    // `lai init --yes` force-installs `langium-ai-tools@latest`, overriding our
    // pin. Reinstall the pinned spec so the eval is gated against the version
    // the docs claim, not whatever `@latest` happens to be.
    log(`re-pinning tools (${PINS.TOOLS_PKG})`);
    run('npm', ['install', PINS.TOOLS_PKG], { cwd: fixture });

    // 4b. reconcile the rendered eval's service import. `lai init` derives the
    //     import from the detected *source* module (src/language-server/
    //     minilogo-module.ts -> ../src/language-server/minilogo-module.js), but
    //     minilogo's tsc emits to out/ (rootDir ./src, outDir out), so the .js
    //     lives at out/language-server/minilogo-module.js. Repoint src/ -> out/
    //     so the runtime import resolves to the compiled module.
    let evalSrc = readFileSync(evalFile, 'utf-8');
    const importRe = /from (['"])(\.\.\/(?:src|out)\/[^'"]*minilogo-module[^'"]*|\.\.\/src\/language\/main\.js)\1/;
    const want = "from '../out/language-server/minilogo-module.js'";
    if (importRe.test(evalSrc)) {
        const patched = evalSrc.replace(importRe, want);
        if (patched !== evalSrc) {
            log('reconciling rendered eval service import to the compiled minilogo module (out/)');
            evalSrc = patched;
            writeFileSync(evalFile, evalSrc, 'utf-8');
        }
    } else {
        fail('could not locate the rendered service import in basic.eval.ts to reconcile');
    }
    // sanity: the reconciled import target must exist on disk (compiled in step 2)
    const compiledModule = path.join(fixture, 'out', 'language-server', 'minilogo-module.js');
    if (!existsSync(compiledModule)) {
        fail(`expected compiled services module missing: ${compiledModule} (did build:tsc run?)`);
    }

    // 5. generate descriptor + sysprompt. `lai evaluate` refuses to run without a
    //    sysprompt (it returns early), so this is required for a meaningful gate,
    //    not just cosmetic — and it exercises the generate plumbing too.
    log('lai gen descriptor --yes --fresh');
    run(lai, ['gen', 'descriptor', '--yes', '--fresh'], { cwd: fixture });
    log('lai gen sysprompt --yes --fresh');
    run(lai, ['gen', 'sysprompt', '--yes', '--fresh'], { cwd: fixture });

    // 6. lai evaluate — the actual smoke. STUB cases short-circuit the provider,
    //    so this must exit 0 and persist a run report.
    log('lai evaluate');
    run(lai, ['evaluate'], { cwd: fixture });

    // 7. assert a run report was written under .langium-ai/
    const runsDir = path.join(fixture, '.langium-ai');
    if (!existsSync(runsDir)) {
        fail('.langium-ai/ run directory was not created by `lai evaluate`');
    }
    const runFiles = readdirSync(runsDir).filter((f) => f.startsWith('eval-') && f.endsWith('.json'));
    if (runFiles.length === 0) {
        fail('no eval-*.json run report written under .langium-ai/');
    }

    // 8. assert the report shape: cases ran and carry the STUB marker (proves we
    //    exercised the harness, not that we skipped everything).
    const report = JSON.parse(readFileSync(path.join(runsDir, runFiles[0]), 'utf-8'));
    const results = Array.isArray(report.results) ? report.results : [];
    if (results.length === 0) {
        fail('run report contains no case results');
    }
    const stubbed = results.filter((r) => r?.data?.stub === true);
    if (stubbed.length === 0) {
        fail('no STUB-marked cases in the report — the scaffolded stub eval did not run as expected');
    }

    console.log(
        `\n✓ lane2 smoke PASSED — ${results.length} case(s) ran, ${stubbed.length} stubbed, report: ${runFiles[0]}`,
    );
} catch (err) {
    cleanup = false; // keep the workdir around for debugging on failure
    console.error(err?.message ?? err);
    fail('a command exited non-zero (see output above)');
} finally {
    if (cleanup) {
        rmSync(work, { recursive: true, force: true });
    } else {
        console.error(`\n(workdir preserved for debugging: ${work})`);
    }
}
