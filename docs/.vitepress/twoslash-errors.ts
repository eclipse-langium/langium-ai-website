// makes twoslash build failures actually diagnosable.
//
// by default twoslash throws an error whose body looks like:
//
//   eval.ts
//     [2554] 1119 - Expected 2-3 arguments, but got 1.
//
// the `1119` is a flat character offset into an internal virtual file, not a
// line number, and nothing points at the offending source line. this helper
// reconstructs each virtual file exactly as twoslash does (splitting on
// `// @filename:` and dropping the `//---cut---` marker), maps the offset back
// to a line/column, and prints the source line with a caret.

interface ParsedDiagnostic {
    file: string;
    code: number;
    start: number;
    text: string;
}

// twoslash builds one virtual file per `// @filename:` directive, defaulting to
// `index.ts`. the `//---cut---` marker (any surrounding whitespace) is removed
// from the emitted file but everything above it still counts toward offsets.
function buildVirtualFiles(code: string): Map<string, string> {
    const files = new Map<string, string>();
    let current = 'index.ts';
    let buffer: string[] = [];

    const flush = () => {
        files.set(current, buffer.join('\n'));
    };

    for (const line of code.split('\n')) {
        const match = line.match(/^\/\/\s*@filename:\s*(.+)\s*$/);
        if (match) {
            flush();
            current = match[1].trim();
            buffer = [];
            continue;
        }
        // the cut marker is stripped from the emitted file, so skip it (but keep
        // preceding lines, which twoslash also keeps for offset purposes)
        if (/^\s*\/\/\s*-+\s*cut\s*-+\s*$/.test(line)) {
            continue;
        }
        buffer.push(line);
    }
    flush();
    return files;
}

// resolve a flat char offset into { line, column, text } within a file
function locate(content: string, offset: number): { line: number; column: number; text: string } {
    const upto = content.slice(0, offset);
    const line = upto.split('\n').length;
    const lastNewline = upto.lastIndexOf('\n');
    const column = offset - lastNewline;
    const text = content.split('\n')[line - 1] ?? '';
    return { line, column, text };
}

// pull `[code] start - text` diagnostic lines out of the twoslash error body
function parseDiagnostics(message: string): ParsedDiagnostic[] {
    const lines = message.split('\n');
    const diagnostics: ParsedDiagnostic[] = [];
    let currentFile = 'index.ts';

    for (const line of lines) {
        const fileMatch = line.match(/^([\w./-]+\.tsx?)\s*$/);
        if (fileMatch) {
            currentFile = fileMatch[1];
            continue;
        }
        const diagMatch = line.match(/\[(\d+)\]\s*(\d+)\s*-\s*(.+)$/);
        if (diagMatch) {
            diagnostics.push({
                file: currentFile,
                code: Number(diagMatch[1]),
                start: Number(diagMatch[2]),
                text: diagMatch[3].trim(),
            });
        }
    }
    return diagnostics;
}

// build the readable diagnostic report; returns null if nothing could be parsed
export function formatTwoslashError(error: unknown, code: string): string | null {
    const raw = error instanceof Error ? error.message : String(error);
    const diagnostics = parseDiagnostics(raw);
    if (diagnostics.length === 0) {
        return null;
    }

    const files = buildVirtualFiles(code);
    const parts: string[] = ['Twoslash type errors:', ''];

    for (const diag of diagnostics) {
        const content = files.get(diag.file) ?? files.get('index.ts') ?? code;
        const { line, column, text } = locate(content, diag.start);
        const caret = ' '.repeat(Math.max(0, column - 1)) + '^';
        parts.push(
            `  ${diag.file}:${line}:${column}  TS${diag.code}: ${diag.text}`,
            '',
            `    ${text}`,
            `    ${caret}`,
            ''
        );
    }

    parts.push(
        'To intentionally document an error, add a twoslash directive above the block, e.g.:',
        `  // @errors: ${[...new Set(diagnostics.map((d) => d.code))].join(' ')}`
    );

    return parts.join('\n');
}
