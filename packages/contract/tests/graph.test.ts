// Layering hygiene (a hard requirement): the @injitools/contract import graph contains no
// express / got / typeorm and no node-only dependencies whatsoever — only zod + reflect-metadata.
// This keeps the DTO/validation engine a dependency-light base that core/db/auth build on without
// cycles.
//
// A cheap, fast gate: we statically walk the built package (dist) graph from the entry
// and collect all "bare" (non-relative) specifiers. Only zod and reflect-metadata are allowed.
// Any node-builtin or server dependency → failure.
import {test, expect} from "vitest";
import {readFileSync} from "node:fs";
import {builtinModules} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));

/** Bare specifiers from import/export ... from "x", side-effect import "x", require("x"). */
function bareSpecifiers(code: string): string[] {
    const specs = new Set<string>();
    const patterns = [
        /(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g, // import ... from "x"
        /\bimport\s*["']([^"']+)["']/g,                        // import "x" (side-effect)
        /\brequire\(\s*["']([^"']+)["']\s*\)/g,                // require("x")
        /\bimport\(\s*["']([^"']+)["']\s*\)/g,                 // dynamic import("x")
    ];
    for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(code))) specs.add(m[1]);
    }
    return [...specs];
}

/** Recursively walks the graph from the entry, returning the set of external (non-relative) packages. */
function collectExternalDeps(entry: string): Set<string> {
    const seen = new Set<string>();
    const external = new Set<string>();
    const stack = [entry];
    while (stack.length) {
        const file = stack.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        const code = readFileSync(file, "utf8");
        for (const spec of bareSpecifiers(code)) {
            if (spec.startsWith(".")) {
                stack.push(path.resolve(path.dirname(file), spec));
            } else {
                external.add(spec);
            }
        }
    }
    return external;
}

const BANNED = ["express", "got", "typeorm", "express-serve-static-core", "zod-openapi", "@injitools/db", "@injitools/auth"];
const ALLOWED = new Set(["zod", "reflect-metadata"]);

test("the @injitools/contract graph contains only zod + reflect-metadata, no node-only dependencies", () => {
    const entry = path.resolve(testsDir, "../dist/index.js"); // the built package entry
    const external = collectExternalDeps(entry);

    // 1. Explicit denylist of server dependencies.
    for (const banned of BANNED) {
        expect(external.has(banned), `a forbidden dependency "${banned}" was found in the graph`).toBe(false);
    }

    // 2. No node-core modules (fs, http, net, node:*, etc.).
    const nodeCore = [...external].filter(
        (s) => s.startsWith("node:") || builtinModules.includes(s),
    );
    expect(nodeCore, `node-core modules were found in the graph: ${nodeCore.join(", ")}`).toEqual([]);

    // 3. Allowlist: nothing at all except zod + reflect-metadata.
    const unexpected = [...external].filter((s) => !ALLOWED.has(s));
    expect(unexpected, `unexpected external dependencies: ${unexpected.join(", ")}`).toEqual([]);
});
